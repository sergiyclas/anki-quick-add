import { afterEach, expect, test, vi } from "vitest";
import { gemini, toOpenApiSubset } from "../src/lib/providers/gemini";
import { mockFetch } from "./helpers/mockFetch";

const schema = {
  type: "object" as const,
  properties: { uk: { type: "string" as const }, list: { type: "array" as const, items: { type: "string" as const } } },
  required: ["uk", "list"],
  additionalProperties: false as const,
};
const request = { system: "sys", user: "Word: hello", schema, schemaName: "anki_card", maxTokens: 2048 };
const cfg = { model: "gemini-3.7-flash", effort: "low" as const };
const ok = (text: string) => ({
  status: 200,
  body: { modelVersion: "gemini-3.7-flash-001", candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] },
});

afterEach(() => vi.unstubAllGlobals());

test("generateContent request shape with responseJsonSchema and thinking level", async () => {
  const calls = mockFetch(ok('{"uk":"привіт","list":[]}'));
  const result = await gemini.generate(request, cfg, "g-key");
  expect(result.json).toEqual({ uk: "привіт", list: [] });
  expect(result.model).toBe("gemini-3.7-flash-001");
  expect(calls[0]!.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent");
  expect((calls[0]!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("g-key");
  expect(calls[0]!.body).toEqual({
    systemInstruction: { parts: [{ text: "sys" }] },
    contents: [{ role: "user", parts: [{ text: "Word: hello" }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingLevel: "low" },
    },
  });
});

test("falls back: drops thinkingConfig, then switches to responseSchema", async () => {
  const calls = mockFetch((call, i) => {
    const gc = (call.body!["generationConfig"] as Record<string, unknown>) ?? {};
    if (i === 0) return { status: 400, body: { error: { message: "thinking_level is not supported" } } };
    if ("responseJsonSchema" in gc) return { status: 400, body: { error: { message: "Unknown name responseJsonSchema" } } };
    return ok("{}");
  });
  await gemini.generate(request, cfg, "k");
  expect(calls).toHaveLength(3);
  const last = calls[2]!.body!["generationConfig"] as Record<string, unknown>;
  expect(last).not.toHaveProperty("thinkingConfig");
  expect(last).not.toHaveProperty("responseJsonSchema");
  expect(last["responseSchema"]).toEqual(toOpenApiSubset(schema));
});

test("2.5 models get no thinking config; errors map to codes", async () => {
  const calls = mockFetch(ok("{}"));
  await gemini.generate(request, { model: "gemini-2.5-flash", effort: "high" }, "k");
  expect(calls[0]!.body!["generationConfig"]).not.toHaveProperty("thinkingConfig");

  mockFetch({ status: 200, body: { promptFeedback: { blockReason: "SAFETY" } } });
  await expect(gemini.generate(request, cfg, "k")).rejects.toMatchObject({ code: "refusal" });

  mockFetch({ status: 200, body: { candidates: [{ content: { parts: [{ text: "{" }] }, finishReason: "MAX_TOKENS" }] } });
  await expect(gemini.generate(request, cfg, "k")).rejects.toMatchObject({ code: "truncated" });
});

test("toOpenApiSubset strips additionalProperties and adds propertyOrdering", () => {
  expect(toOpenApiSubset(schema)).toEqual({
    type: "object",
    properties: { uk: { type: "string" }, list: { type: "array", items: { type: "string" } } },
    required: ["uk", "list"],
    propertyOrdering: ["uk", "list"],
  });
});

test("listModels strips the models/ prefix and keeps generateContent models", async () => {
  mockFetch({
    status: 200,
    body: {
      models: [
        { name: "models/gemini-3.7-flash", displayName: "Gemini 3.7 Flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/embedding-001", displayName: "Embedding", supportedGenerationMethods: ["embedContent"] },
      ],
    },
  });
  expect(await gemini.listModels(cfg, "k")).toEqual([{ id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" }]);
});
