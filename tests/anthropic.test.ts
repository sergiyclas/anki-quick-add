import { afterEach, expect, test, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schema";
import { anthropic } from "../src/lib/providers/anthropic";
import { ProviderError } from "../src/lib/providers/types";

const schema = { type: "object" as const, properties: { uk: { type: "string" as const } }, required: ["uk"], additionalProperties: false as const };
const request = { system: "sys", user: "Word: hello", schema, schemaName: "anki_card", maxTokens: 1024, word: "hello", source: "en", target: "uk", generation: DEFAULT_SETTINGS.generation };

function mockFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

test("sends structured-output request with browser header and parses text blocks", async () => {
  const calls = mockFetch(200, {
    model: "claude-sonnet-5",
    stop_reason: "end_turn",
    content: [{ type: "thinking", thinking: "" }, { type: "text", text: '{"uk":' }, { type: "text", text: '"привіт"}' }],
  });
  const result = await anthropic.generate(request, { model: "claude-sonnet-5", effort: "low" }, "sk-test");
  expect(result).toEqual({ json: { uk: "привіт" }, raw: '{"uk":"привіт"}', model: "claude-sonnet-5" });

  const { url, init } = calls[0]!;
  expect(url).toBe("https://api.anthropic.com/v1/messages");
  const headers = init.headers as Record<string, string>;
  expect(headers["x-api-key"]).toBe("sk-test");
  expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  expect(JSON.parse(init.body as string)).toEqual({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: "sys",
    messages: [{ role: "user", content: "Word: hello" }],
    output_config: { format: { type: "json_schema", schema }, effort: "low" },
  });
});

test("omits effort for haiku", async () => {
  const calls = mockFetch(200, { model: "claude-haiku-4-5", stop_reason: "end_turn", content: [{ type: "text", text: "{}" }] });
  await anthropic.generate(request, { model: "claude-haiku-4-5", effort: "low" }, "k");
  expect(JSON.parse(calls[0]!.init.body as string).output_config).toEqual({ format: { type: "json_schema", schema } });
});

test("maps auth failures, refusals and truncation to ProviderError codes", async () => {
  mockFetch(401, { error: { message: "invalid x-api-key" } });
  await expect(anthropic.generate(request, { model: "claude-sonnet-5", effort: "low" }, "bad")).rejects.toMatchObject({ code: "auth" });

  mockFetch(200, { model: "m", stop_reason: "refusal", content: [] });
  await expect(anthropic.generate(request, { model: "m", effort: "low" }, "k")).rejects.toBeInstanceOf(ProviderError);

  mockFetch(200, { model: "m", stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] });
  await expect(anthropic.generate(request, { model: "m", effort: "low" }, "k")).rejects.toMatchObject({ code: "truncated" });
});

test("listModels returns ids and labels", async () => {
  mockFetch(200, { data: [{ id: "claude-sonnet-5", display_name: "Claude Sonnet 5" }] });
  expect(await anthropic.listModels({ model: "", effort: "low" }, "k")).toEqual([{ id: "claude-sonnet-5", label: "Claude Sonnet 5" }]);
});
