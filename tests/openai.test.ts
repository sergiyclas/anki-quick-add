import { afterEach, expect, test, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schema";
import { openai } from "../src/lib/providers/openai";
import { mockFetch } from "./helpers/mockFetch";

const schema = { type: "object" as const, properties: { uk: { type: "string" as const } }, required: ["uk"], additionalProperties: false as const };
const request = { system: "sys", user: "Word: hello", schema, schemaName: "anki_card", maxTokens: 2048, word: "hello", source: "en", target: "uk", generation: DEFAULT_SETTINGS.generation };
const cfg = { model: "gpt-5.6-terra", effort: "low" as const };
const ok = (text: string) => ({
  status: 200,
  body: { status: "completed", model: "gpt-5.6-terra", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text }] }] },
});

afterEach(() => vi.unstubAllGlobals());

test("Responses API request shape and output_text parsing", async () => {
  const calls = mockFetch(ok('{"uk":"привіт"}'));
  const result = await openai.generate(request, cfg, "sk-x");
  expect(result).toEqual({ json: { uk: "привіт" }, raw: '{"uk":"привіт"}', model: "gpt-5.6-terra" });
  expect(calls[0]!.url).toBe("https://api.openai.com/v1/responses");
  expect((calls[0]!.init.headers as Record<string, string>)["authorization"]).toBe("Bearer sk-x");
  expect(calls[0]!.body).toEqual({
    model: "gpt-5.6-terra",
    input: [
      { role: "system", content: "sys" },
      { role: "user", content: "Word: hello" },
    ],
    text: { format: { type: "json_schema", name: "anki_card", schema, strict: true } },
    reasoning: { effort: "low" },
    max_output_tokens: 2048,
  });
});

test("retries once without reasoning when the model rejects it", async () => {
  const calls = mockFetch((_call, i) => (i === 0 ? { status: 400, body: { error: { message: "Unsupported parameter: 'reasoning'" } } } : ok("{}")));
  await openai.generate(request, cfg, "k");
  expect(calls).toHaveLength(2);
  expect(calls[1]!.body).not.toHaveProperty("reasoning");
});

test("refusal, incomplete and auth errors", async () => {
  mockFetch({ status: 200, body: { status: "completed", model: "m", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] } });
  await expect(openai.generate(request, cfg, "k")).rejects.toMatchObject({ code: "refusal" });

  mockFetch({ status: 200, body: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, model: "m", output: [] } });
  await expect(openai.generate(request, cfg, "k")).rejects.toMatchObject({ code: "truncated" });

  mockFetch({ status: 401, body: { error: { message: "bad key" } } });
  await expect(openai.generate(request, cfg, "k")).rejects.toMatchObject({ code: "auth" });
});

test("listModels keeps chat models only", async () => {
  mockFetch({ status: 200, body: { data: [{ id: "gpt-5.6-terra" }, { id: "gpt-4o-realtime-preview" }, { id: "text-embedding-3-small" }, { id: "gpt-5.6-luna" }] } });
  expect(await openai.listModels(cfg, "k")).toEqual([{ id: "gpt-5.6-luna" }, { id: "gpt-5.6-terra" }]);
});
