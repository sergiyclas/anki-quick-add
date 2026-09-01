import { HttpError, fetchJson, postJson } from "../http";
import { parseJsonObject } from "./jsonExtract";
import { type ProviderAdapter, ProviderError } from "./types";

const BASE = "https://api.anthropic.com/v1";
const TIMEOUT_MS = 60_000;

interface MessagesResponse {
  content: { type: string; text?: string }[];
  stop_reason: string;
  model: string;
}

interface ModelsResponse {
  data: { id: string; display_name?: string }[];
}

function headers(key: string): Record<string, string> {
  return {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

function mapError(e: unknown): never {
  if (e instanceof HttpError) {
    throw new ProviderError(e.status === 401 || e.status === 403 ? "auth" : "http", e.message);
  }
  if (e instanceof ProviderError) throw e;
  throw new ProviderError("network", e instanceof Error ? e.message : String(e));
}

export const anthropic: ProviderAdapter = {
  id: "anthropic",

  hostPatterns: () => ["https://api.anthropic.com/*"],

  async listModels(_cfg, key) {
    const res = await fetchJson<ModelsResponse>(`${BASE}/models?limit=100`, { headers: headers(key) }).catch(mapError);
    return res.data.map((m) => ({ id: m.id, label: m.display_name }));
  },

  async generate(req, cfg, key) {
    const body: Record<string, unknown> = {
      model: cfg.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
      output_config: { format: { type: "json_schema", schema: req.schema } },
    };
    // `effort` is rejected by Haiku 4.5; every other current model accepts it.
    if (!cfg.model.startsWith("claude-haiku")) {
      (body["output_config"] as Record<string, unknown>)["effort"] = cfg.effort;
    }
    const res = await postJson<MessagesResponse>(`${BASE}/messages`, body, {
      headers: headers(key),
      timeoutMs: TIMEOUT_MS,
      signal: req.signal,
    }).catch(mapError);

    if (res.stop_reason === "refusal") throw new ProviderError("refusal", "The model refused the request");
    if (res.stop_reason === "max_tokens") throw new ProviderError("truncated", "The response was cut off (max_tokens)");
    const raw = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    return { json: parseJsonObject(raw), raw, model: res.model };
  },
};
