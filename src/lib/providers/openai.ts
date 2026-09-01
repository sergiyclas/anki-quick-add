import { HttpError, fetchJson, postJson } from "../http";
import { parseJsonObject } from "./jsonExtract";
import { type ProviderAdapter, ProviderError } from "./types";

const BASE = "https://api.openai.com/v1";
const TIMEOUT_MS = 60_000;
const EXCLUDED = /(realtime|audio|tts|transcribe|image|search|embedding|moderation|codex)/;

interface ResponsesResponse {
  status: string;
  incomplete_details?: { reason?: string };
  model: string;
  output: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
}

interface ModelsResponse {
  data: { id: string }[];
}

function headers(key: string): Record<string, string> {
  return { authorization: `Bearer ${key}` };
}

function mapError(e: unknown): never {
  if (e instanceof HttpError) throw new ProviderError(e.status === 401 || e.status === 403 ? "auth" : "http", e.message);
  if (e instanceof ProviderError) throw e;
  throw new ProviderError("network", e instanceof Error ? e.message : String(e));
}

export const openai: ProviderAdapter = {
  id: "openai",

  hostPatterns: () => ["https://api.openai.com/*"],

  async listModels(_cfg, key) {
    const res = await fetchJson<ModelsResponse>(`${BASE}/models`, { headers: headers(key) }).catch(mapError);
    return res.data
      .map((m) => m.id)
      .filter((id) => id.startsWith("gpt-") && !EXCLUDED.test(id))
      .sort()
      .map((id) => ({ id }));
  },

  async generate(req, cfg, key) {
    const body: Record<string, unknown> = {
      model: cfg.model,
      input: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      text: { format: { type: "json_schema", name: req.schemaName, schema: req.schema, strict: true } },
      reasoning: { effort: cfg.effort },
      max_output_tokens: req.maxTokens,
    };
    const post = () =>
      postJson<ResponsesResponse>(`${BASE}/responses`, body, { headers: headers(key), timeoutMs: TIMEOUT_MS, signal: req.signal });

    let res: ResponsesResponse;
    try {
      res = await post();
    } catch (e) {
      // Some models reject the reasoning parameter; retry once without it.
      if (e instanceof HttpError && e.status === 400 && /reasoning/i.test(e.body)) {
        delete body["reasoning"];
        res = await post().catch(mapError);
      } else {
        mapError(e);
      }
    }

    if (res.status === "incomplete") {
      const reason = res.incomplete_details?.reason ?? "unknown";
      throw new ProviderError(reason === "max_output_tokens" ? "truncated" : "http", `Response incomplete: ${reason}`);
    }
    const message = res.output.find((o) => o.type === "message");
    const refusal = message?.content?.find((c) => c.type === "refusal");
    if (refusal) throw new ProviderError("refusal", refusal.refusal ?? "The model refused the request");
    const raw = (message?.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text ?? "")
      .join("");
    return { json: parseJsonObject(raw), raw, model: res.model };
  },
};
