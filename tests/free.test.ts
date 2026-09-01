import { afterEach, expect, test, vi } from "vitest";
import { maxBatchConcurrency, normalizeCode, redeemCode, tierAtLeast } from "../src/lib/license";
import { parseGtxFull } from "../src/lib/providers/free/gtx";
import { free } from "../src/lib/providers/free";
import { pickTatoebaExamples } from "../src/lib/providers/free/tatoeba";
import { buildCardSchema } from "../src/lib/generation/schema";
import { validateAgainstSchema } from "../src/lib/generation/validate";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schema";
import { mockFetch } from "./helpers/mockFetch";

afterEach(() => vi.unstubAllGlobals());

// Shape recorded from the live endpoint for en->uk "lighthouse" (dt=t,bd,ss,md; no examples returned).
const GTX_LIGHTHOUSE = [
  [["маяк", "lighthouse", null, null, 10], [null, null, "mayak", "ˈlīt(h)ous"]],
  [["noun", ["маяк"], [["маяк", ["lighthouse", "beacon", "pike", "watchtower", "seamark"]]], "lighthouse", 1]],
  "en",
  null,
  null,
  [["lighthouse", null, [[7], [5]]]],
  1,
  [],
  [["en"], null, [1], ["en"]],
  null,
  null,
  [["noun", [[["watchtower", "fanal"], "m_en_gbus0581550.005", [["archaic"]]], [["beacon", "pharos", "phare", "leading light"], "m_en_gbus0581550.005"]], "lighthouse", 1]],
  [["noun", [["a tower or other structure containing a beacon light to warn or guide ships at sea.", "m_en_gbus0581550.005"]], "lighthouse", 1]],
];

test("parseGtxFull recognises translation, dictionary alternatives, synonyms (minus archaic) and definitions", () => {
  const r = parseGtxFull(GTX_LIGHTHOUSE);
  expect(r.translation).toBe("маяк");
  expect(r.alternatives).toEqual([{ partOfSpeech: "noun", terms: ["маяк"] }]);
  expect(r.synonyms).toEqual(["beacon", "pharos", "phare", "leading light"]);
  expect(r.definitions[0]?.text).toMatch(/^a tower/);
  expect(r.examples).toEqual([]);
});

test("parseGtxFull picks up examples when present and tolerates junk", () => {
  const withExamples = [...GTX_LIGHTHOUSE, [[["The <b>lighthouse</b> keeper waved.", null, null, null, 3, "id"]]]];
  expect(parseGtxFull(withExamples).examples).toEqual(["The lighthouse keeper waved."]);
  expect(parseGtxFull("garbage")).toEqual({ translation: "", alternatives: [], synonyms: [], definitions: [], examples: [] });
  expect(parseGtxFull([[["hi", "hello"]], null]).translation).toBe("hi");
});

test("pickTatoebaExamples keeps sentences containing the word, prefers ones with a target translation", () => {
  const res = {
    results: [
      { text: "Adriano left for the lighthouse.", translations: [] },
      { text: "There's the lighthouse.", translations: [[{ text: "Ось маяк.", lang: "ukr" }], [{ text: "Majakka on tuolla.", lang: "fin" }]] },
      { text: "Unrelated sentence.", translations: [] },
      { text: "x".repeat(200) + " lighthouse", translations: [] },
    ],
  };
  expect(pickTatoebaExamples(res, "lighthouse", "ukr", 3)).toEqual([
    { text: "There's the lighthouse.", translation: "Ось маяк." },
    { text: "Adriano left for the lighthouse." },
  ]);
});

test("free provider assembles a schema-valid card from gtx + dictionaryapi + tatoeba", async () => {
  mockFetch((call) => {
    if (call.url.includes("translate.googleapis.com")) return { status: 200, body: GTX_LIGHTHOUSE };
    if (call.url.includes("dictionaryapi.dev")) {
      return {
        status: 200,
        body: [{ phonetic: "/ˈlaɪt.haʊs/", meanings: [{ partOfSpeech: "noun", synonyms: ["beacon"], definitions: [{ definition: "A tower with a light.", example: "the lighthouse guided the ships" }] }] }],
      };
    }
    if (call.url.includes("tatoeba.org")) {
      return { status: 200, body: { results: [{ text: "My uncle works in a lighthouse.", translations: [[{ text: "Мій дядько працює на маяку.", lang: "ukr" }]] }] } };
    }
    return { status: 404, body: {} };
  });
  const settings = DEFAULT_SETTINGS;
  const schema = buildCardSchema(settings.generation, true);
  const result = await free.generate(
    { system: "", user: "", schema, schemaName: "anki_card", maxTokens: 0, word: "lighthouse", source: "en", target: "uk", generation: settings.generation },
    settings.providers.free,
    "",
  );
  expect(validateAgainstSchema(schema, result.json)).toEqual([]);
  const json = result.json as Record<string, unknown>;
  expect(json["translations"]).toEqual(["маяк"]);
  expect(json["transcription"]).toBe("/ˈlaɪt.haʊs/");
  expect(json["partOfSpeech"]).toBe("noun");
  expect(json["synonyms"]).toEqual(["beacon", "pharos", "phare", "leading light"]);
  expect(json["examples"]).toEqual([{ text: "My uncle works in a lighthouse." }, { text: "The lighthouse guided the ships." }]);
  expect(json["grammar"]).toBe("");
  expect(json["imageQuery"]).toBe("lighthouse");
  expect(result.model).toBe("free");
});

test("promo codes: hashed lookup, normalisation, tiers", async () => {
  expect(normalizeCode("  lexicon - pro ")).toBe("LEXICON-PRO");
  expect(await redeemCode("lexicon-pro")).toBe("pro");
  expect(await redeemCode("FOUNDER-2026")).toBe("founder");
  expect(await redeemCode("nope")).toBeNull();
  expect(await redeemCode("")).toBeNull();
  expect(tierAtLeast("founder", "pro")).toBe(true);
  expect(tierAtLeast("free", "pro")).toBe(false);
  expect([maxBatchConcurrency("free"), maxBatchConcurrency("pro"), maxBatchConcurrency("founder")]).toEqual([1, 2, 3]);
});

test("pro slots enter the schema and prompt only when unlocked", async () => {
  const { buildSystemPrompt } = await import("../src/lib/generation/prompt");
  const gen = { ...DEFAULT_SETTINGS.generation, mnemonic: true, etymology: true };
  const locked = { ...DEFAULT_SETTINGS, generation: gen };
  const unlocked = { ...locked, license: { tier: "pro" as const } };
  expect(buildSystemPrompt(locked)).not.toContain("mnemonic");
  expect(buildSystemPrompt(unlocked)).toContain("- mnemonic:");
  expect(buildSystemPrompt(unlocked)).toContain("- etymology:");
  const schema = buildCardSchema(gen, { image: false, mnemonic: true, etymology: true });
  expect(schema.type === "object" && schema.required).toEqual(["translations", "transcription", "partOfSpeech", "synonyms", "examples", "grammar", "mnemonic", "etymology"]);
});
