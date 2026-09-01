import { HttpError, fetchJson, postJson } from "../http";
import type { ProviderSettings } from "../settings/schema";
import { parseJsonObject } from "./jsonExtract";
import { COMPAT_PRESETS } from "./presets";
import { type GenerateRequest, type ProviderAdapter, ProviderError } from "./types";

const TIMEOUT_MS = 90_000;

interface ChatResponse {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
}

interface ModelsResponse {
  data: { id: string; name?: string }[];
}

function baseUrl(cfg: ProviderSettings): string {
  const url = (cfg.baseUrl ?? "").trim().replace(/\/+$/, "");
  if (!url) throw new ProviderError("http", "Base URL is not set");
  return url;
}

// Local servers (Ollama, LM Studio) ignore the key but some reject an empty bearer token.
function headers(key: string): Record<string, string> {
  return { authorization: `Bearer ${key || "none"}` };
}

function mapError(e: unknown): never {
  if (e instanceof HttpError) throw new ProviderError(e.status === 401 || e.status === 403 ? "auth" : "http", e.message);
  if (e instanceof ProviderError) throw e;
  throw new ProviderError("network", e instanceof Error ? e.message : String(e));
}

export function resolveJsonMode(cfg: ProviderSettings): "json_schema" | "json_object" {
  if (cfg.jsonMode && cfg.jsonMode !== "auto") return cfg.jsonMode;
  return COMPAT_PRESETS.find((p) => p.id === cfg.preset)?.jsonMode ?? "json_schema";
}

function buildBody(req: GenerateRequest, cfg: ProviderSettings, mode: "json_schema" | "json_object"): Record<string, unknown> {
  const system =
    mode === "json_object"
      ? `${req.system}\n\nRespond with a single JSON object (no prose, no code fences) that matches this JSON Schema:\n${JSON.stringify(req.schema)}`
      : req.system;
  return {
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: req.user },
    ],
    response_format:
      mode === "json_schema"
        ? { type: "json_schema", json_schema: { name: req.schemaName, strict: true, schema: req.schema } }
        : { type: "json_object" },
    max_tokens: req.maxTokens,
  };
}

export const openaiCompat: ProviderAdapter = {
  id: "compat",

  hostPatterns(cfg) {
    try {
      const u = new URL(baseUrl(cfg));
      return [`${u.protocol}//${u.host}/*`];
    } catch {
      return [];
    }
  },

  async listModels(cfg, key) {
    const res = await fetchJson<ModelsResponse>(`${baseUrl(cfg)}/models`, { headers: headers(key) }).catch(mapError);
    return res.data.map((m) => ({ id: m.id, label: m.name })).sort((a, b) => a.id.localeCompare(b.id));
  },

  async generate(req, cfg, key) {
    const url = `${baseUrl(cfg)}/chat/completions`;
    let mode = resolveJsonMode(cfg);
    const post = () =>
      postJson<ChatResponse>(url, buildBody(req, cfg, mode), { headers: headers(key), timeoutMs: TIMEOUT_MS, signal: req.signal });

    let res: ChatResponse;
    try {
      res = await post();
    } catch (e) {
      // Servers without json_schema support answer 400; fall back to json_object with the schema in the prompt.
      if (e instanceof HttpError && e.status === 400 && mode === "json_schema") {
        mode = "json_object";
        res = await post().catch(mapError);
      } else {
        mapError(e);
      }
    }

    const choice = res.choices?.[0];
    if (choice?.finish_reason === "length") throw new ProviderError("truncated", "The response was cut off (length)");
    const raw = choice?.message?.content ?? "";
    return { json: parseJsonObject(raw), raw, model: res.model ?? cfg.model };
  },
};
