import { afterEach, expect, test, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schema";
import { openaiCompat, resolveJsonMode } from "../src/lib/providers/openaiCompat";
import type { ProviderSettings } from "../src/lib/settings/schema";
import { mockFetch } from "./helpers/mockFetch";

const schema = { type: "object" as const, properties: { uk: { type: "string" as const } }, required: ["uk"], additionalProperties: false as const };
const request = { system: "sys", user: "Word: hello", schema, schemaName: "anki_card", maxTokens: 2048, word: "hello", source: "en", target: "uk", generation: DEFAULT_SETTINGS.generation };
const openrouter: ProviderSettings = { model: "meta-llama/llama-3.3-70b-instruct", effort: "low", baseUrl: "https://openrouter.ai/api/v1/", preset: "openrouter", jsonMode: "auto" };
const ok = (content: string, finish = "stop") => ({ status: 200, body: { model: "x", choices: [{ message: { content }, finish_reason: finish }] } });

afterEach(() => vi.unstubAllGlobals());

test("json_schema request against the preset base URL", async () => {
  const calls = mockFetch(ok('{"uk":"привіт"}'));
  const result = await openaiCompat.generate(request, openrouter, "or-key");
  expect(result.json).toEqual({ uk: "привіт" });
  expect(calls[0]!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
  expect((calls[0]!.init.headers as Record<string, string>)["authorization"]).toBe("Bearer or-key");
  expect(calls[0]!.body).toEqual({
    model: openrouter.model,
    messages: [
      { role: "system", content: "sys" },
      { role: "user", content: "Word: hello" },
    ],
    response_format: { type: "json_schema", json_schema: { name: "anki_card", strict: true, schema } },
    max_tokens: 2048,
  });
});

test("falls back to json_object with the schema in the prompt when json_schema is rejected", async () => {
  const calls = mockFetch((_c, i) => (i === 0 ? { status: 400, body: { error: "response_format json_schema not supported" } } : ok("```json\n{\"uk\":\"x\"}\n```")));
  const result = await openaiCompat.generate(request, openrouter, "k");
  expect(result.json).toEqual({ uk: "x" });
  expect(calls).toHaveLength(2);
  const body = calls[1]!.body!;
  expect(body["response_format"]).toEqual({ type: "json_object" });
  expect((body["messages"] as { content: string }[])[0]!.content).toContain(JSON.stringify(schema));
});

test("preset json mode resolution and explicit override", () => {
  expect(resolveJsonMode(openrouter)).toBe("json_schema");
  expect(resolveJsonMode({ ...openrouter, preset: "deepseek" })).toBe("json_object");
  expect(resolveJsonMode({ ...openrouter, preset: "deepseek", jsonMode: "json_schema" })).toBe("json_schema");
});

test("local servers get a placeholder bearer token; host pattern derives from base URL", async () => {
  const ollama: ProviderSettings = { model: "llama3", effort: "low", baseUrl: "http://localhost:11434/v1", preset: "ollama", jsonMode: "auto" };
  const calls = mockFetch(ok("{}"));
  await openaiCompat.generate(request, ollama, "");
  expect((calls[0]!.init.headers as Record<string, string>)["authorization"]).toBe("Bearer none");
  expect(openaiCompat.hostPatterns(ollama)).toEqual(["http://localhost:11434/*"]);
  expect(openaiCompat.hostPatterns({ ...ollama, baseUrl: "" })).toEqual([]);
});

test("length and empty responses map to codes", async () => {
  mockFetch(ok("{", "length"));
  await expect(openaiCompat.generate(request, openrouter, "k")).rejects.toMatchObject({ code: "truncated" });
  mockFetch(ok(""));
  await expect(openaiCompat.generate(request, openrouter, "k")).rejects.toMatchObject({ code: "empty" });
});
