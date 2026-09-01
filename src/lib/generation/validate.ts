import type { GenerationSettings } from "../settings/schema";
import type { CardData, ExampleItem, JsonSchema } from "./types";

// Validates a value against the JSON Schema subset emitted by buildCardSchema().
// Returns a list of human-readable problems; empty means valid.
export function validateAgainstSchema(schema: JsonSchema, value: unknown, path = "$"): string[] {
  switch (schema.type) {
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${path}: expected object`];
      const obj = value as Record<string, unknown>;
      const errors: string[] = [];
      for (const key of schema.required) {
        if (!(key in obj)) errors.push(`${path}.${key}: missing`);
      }
      for (const [key, v] of Object.entries(obj)) {
        const sub = schema.properties[key];
        if (!sub) errors.push(`${path}.${key}: unexpected property`);
        else errors.push(...validateAgainstSchema(sub, v, `${path}.${key}`));
      }
      return errors;
    }
    case "array": {
      if (!Array.isArray(value)) return [`${path}: expected array`];
      return value.flatMap((item, i) => validateAgainstSchema(schema.items, item, `${path}[${i}]`));
    }
    case "string":
      if (typeof value !== "string") return [`${path}: expected string`];
      if (schema.enum && !schema.enum.includes(value)) return [`${path}: not one of ${schema.enum.join(", ")}`];
      return [];
    case "number":
      return typeof value === "number" ? [] : [`${path}: expected number`];
    case "integer":
      return Number.isInteger(value) ? [] : [`${path}: expected integer`];
    case "boolean":
      return typeof value === "boolean" ? [] : [`${path}: expected boolean`];
  }
}

function cleanList(items: unknown, limit: number): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const s = item.trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function cleanExamples(items: unknown, limit: number): ExampleItem[] {
  if (!Array.isArray(items)) return [];
  const out: ExampleItem[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const { text, translation } = item as { text?: unknown; translation?: unknown };
    if (typeof text !== "string" || !text.trim()) continue;
    const example: ExampleItem = { text: text.trim() };
    if (typeof translation === "string" && translation.trim()) example.translation = translation.trim();
    out.push(example);
    if (out.length >= limit) break;
  }
  return out;
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Trims, dedupes and caps the model output to the configured counts.
export function normalizeCardData(raw: Record<string, unknown>, word: string, g: GenerationSettings, context?: string): CardData {
  const card: CardData = {
    word,
    translations: cleanList(raw["translations"], g.translationsCount),
    examples: cleanExamples(raw["examples"], Math.max(g.examplesCount, 1)),
  };
  const transcription = cleanText(raw["transcription"]);
  if (transcription) card.transcription = transcription;
  const partOfSpeech = cleanText(raw["partOfSpeech"]);
  if (partOfSpeech) card.partOfSpeech = partOfSpeech;
  const definition = cleanText(raw["definition"]);
  if (definition) card.definition = definition;
  if (g.synonyms) card.synonyms = cleanList(raw["synonyms"], g.synonymsCount);
  const grammar = cleanText(raw["grammar"]);
  if (grammar) card.grammar = grammar;
  const imageQuery = cleanText(raw["imageQuery"]);
  if (imageQuery) card.imageQuery = imageQuery;
  if (context) card.context = context;
  return card;
}
