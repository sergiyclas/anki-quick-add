import type { JsonSchema } from "../generation/types";
import { HttpError, fetchJson, postJson } from "../http";
import { parseJsonObject } from "./jsonExtract";
import { type ProviderAdapter, ProviderError } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 60_000;

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
}

interface ModelsResponse {
  models: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
}

function headers(key: string): Record<string, string> {
  return { "x-goog-api-key": key };
}

function mapError(e: unknown): never {
  if (e instanceof HttpError) throw new ProviderError(e.status === 401 || e.status === 403 ? "auth" : "http", e.message);
  if (e instanceof ProviderError) throw e;
  throw new ProviderError("network", e instanceof Error ? e.message : String(e));
}

// Gemini's older `responseSchema` takes an OpenAPI subset: no additionalProperties, explicit property order.
export function toOpenApiSubset(schema: JsonSchema): Record<string, unknown> {
  switch (schema.type) {
    case "object":
      return {
        type: "object",
        properties: Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toOpenApiSubset(v)])),
        required: schema.required,
        propertyOrdering: Object.keys(schema.properties),
        ...(schema.description ? { description: schema.description } : {}),
      };
    case "array":
      return { type: "array", items: toOpenApiSubset(schema.items), ...(schema.description ? { description: schema.description } : {}) };
    default:
      return { type: schema.type, ...(schema.enum ? { enum: schema.enum } : {}), ...(schema.description ? { description: schema.description } : {}) };
  }
}

export const gemini: ProviderAdapter = {
  id: "gemini",

  hostPatterns: () => ["https://generativelanguage.googleapis.com/*"],

  async listModels(_cfg, key) {
    const res = await fetchJson<ModelsResponse>(`${BASE}/models?pageSize=200`, { headers: headers(key) }).catch(mapError);
    return res.models
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName }));
  },

  async generate(req, cfg, key) {
    const generationConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      responseJsonSchema: req.schema,
      maxOutputTokens: req.maxTokens,
    };
    if (cfg.model.startsWith("gemini-3")) generationConfig["thinkingConfig"] = { thinkingLevel: cfg.effort };
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig,
    };
    const url = `${BASE}/models/${encodeURIComponent(cfg.model)}:generateContent`;
    const post = () => postJson<GenerateContentResponse>(url, body, { headers: headers(key), timeoutMs: TIMEOUT_MS, signal: req.signal });

    let res: GenerateContentResponse | undefined;
    for (let attempt = 0; attempt < 3 && !res; attempt++) {
      try {
        res = await post();
      } catch (e) {
        if (!(e instanceof HttpError) || e.status !== 400) mapError(e);
        // Two known 400s: the thinking knob (model-specific) and the JSON-schema flavour.
        if (/thinking/i.test(e.body) && "thinkingConfig" in generationConfig) {
          delete generationConfig["thinkingConfig"];
        } else if ("responseJsonSchema" in generationConfig) {
          delete generationConfig["responseJsonSchema"];
          generationConfig["responseSchema"] = toOpenApiSubset(req.schema);
        } else {
          mapError(e);
        }
      }
    }
    if (!res) throw new ProviderError("http", "Gemini rejected the request");

    if (res.promptFeedback?.blockReason) throw new ProviderError("refusal", `Blocked: ${res.promptFeedback.blockReason}`);
    const candidate = res.candidates?.[0];
    if (!candidate) throw new ProviderError("empty", "Gemini returned no candidates");
    if (candidate.finishReason === "MAX_TOKENS") throw new ProviderError("truncated", "The response was cut off (MAX_TOKENS)");
    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      throw new ProviderError("refusal", `Generation stopped: ${candidate.finishReason}`);
    }
    const raw = (candidate.content?.parts ?? []).map((p) => p.text ?? "").join("");
    return { json: parseJsonObject(raw), raw, model: res.modelVersion ?? cfg.model };
  },
};
