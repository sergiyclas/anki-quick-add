import { expect, test } from "vitest";
import { buildCardSchema } from "../src/lib/generation/schema";
import type { JsonSchema } from "../src/lib/generation/types";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schema";

function assertPortable(schema: JsonSchema): void {
  const json = JSON.stringify(schema);
  expect(json).not.toMatch(/"(min|max)[A-Za-z]*":/);
  if (schema.type === "object") {
    expect(schema.additionalProperties).toBe(false);
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
    Object.values(schema.properties).forEach(assertPortable);
  } else if (schema.type === "array") {
    assertPortable(schema.items);
  }
}

test("default settings produce the full schema", () => {
  const schema = buildCardSchema(DEFAULT_SETTINGS.generation, true);
  expect(schema.type).toBe("object");
  if (schema.type !== "object") return;
  expect(Object.keys(schema.properties)).toEqual([
    "translations",
    "transcription",
    "partOfSpeech",
    "synonyms",
    "examples",
    "grammar",
    "imageQuery",
  ]);
  assertPortable(schema);
});

test("disabled slots are omitted and example translations are required when on", () => {
  const schema = buildCardSchema(
    { ...DEFAULT_SETTINGS.generation, transcription: false, synonyms: false, grammar: false, exampleTranslations: true },
    false,
  );
  if (schema.type !== "object") throw new Error("expected object");
  expect(Object.keys(schema.properties)).toEqual(["translations", "partOfSpeech", "examples"]);
  const examples = schema.properties["examples"];
  if (examples?.type !== "array" || examples.items.type !== "object") throw new Error("expected examples array of objects");
  expect(examples.items.required).toEqual(["text", "translation"]);
  assertPortable(schema);
});
