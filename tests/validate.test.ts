import { expect, test } from "vitest";
import { buildCardSchema } from "../src/lib/generation/schema";
import { normalizeCardData, validateAgainstSchema } from "../src/lib/generation/validate";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schema";

const schema = buildCardSchema(DEFAULT_SETTINGS.generation, true);
const valid = {
  translations: ["черга", "чергa "],
  transcription: "/kjuː/",
  partOfSpeech: "noun",
  synonyms: ["line", "Line", "queue up", "", "row"],
  examples: [{ text: " We waited in a queue. " }, { text: "" }, { text: "Join the queue." }, { text: "x" }, { text: "y" }],
  grammar: "",
  imageQuery: "Queue area",
};

test("valid output passes; problems are reported with paths", () => {
  expect(validateAgainstSchema(schema, valid)).toEqual([]);
  const { transcription: _omit, ...missing } = valid;
  expect(validateAgainstSchema(schema, { ...missing, extra: 1 })).toEqual(["$.transcription: missing", "$.extra: unexpected property"]);
  expect(validateAgainstSchema(schema, { ...valid, examples: [{ text: 5 }] })).toEqual(["$.examples[0].text: expected string"]);
});

test("normalizeCardData trims, dedupes case-insensitively and caps to configured counts", () => {
  const card = normalizeCardData(valid, "queue", { ...DEFAULT_SETTINGS.generation, synonymsCount: 3 }, "ctx");
  expect(card.translations).toEqual(["черга", "чергa"]);
  expect(card.synonyms).toEqual(["line", "queue up", "row"]);
  expect(card.examples.map((e) => e.text)).toEqual(["We waited in a queue.", "Join the queue.", "x"]);
  expect(card.grammar).toBeUndefined();
  expect(card.imageQuery).toBe("Queue area");
  expect(card.context).toBe("ctx");
});
