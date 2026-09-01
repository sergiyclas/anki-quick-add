import type { GenerationSettings } from "../settings/schema";
import type { JsonSchema } from "./types";

// One schema for every provider's strict mode: all properties required, additionalProperties:false,
// no min*/max* keywords (Anthropic rejects minItems/maxItems). Counts are enforced by the prompt
// and by normalizeCardData().
export interface SchemaExtras {
  image: boolean;
  mnemonic: boolean;
  etymology: boolean;
}

export function buildCardSchema(g: GenerationSettings, extras: boolean | SchemaExtras): JsonSchema {
  const x: SchemaExtras = typeof extras === "boolean" ? { image: extras, mnemonic: false, etymology: false } : extras;
  const properties: Record<string, JsonSchema> = {
    translations: {
      type: "array",
      items: { type: "string" },
      description: `The ${g.translationsCount} most common translations`,
    },
  };
  if (g.transcription) properties["transcription"] = { type: "string", description: "IPA, wrapped in slashes" };
  if (g.partOfSpeech) properties["partOfSpeech"] = { type: "string" };
  if (g.definition) properties["definition"] = { type: "string" };
  if (g.synonyms) properties["synonyms"] = { type: "array", items: { type: "string" } };
  properties["examples"] = {
    type: "array",
    items: {
      type: "object",
      properties: g.exampleTranslations ? { text: { type: "string" }, translation: { type: "string" } } : { text: { type: "string" } },
      required: g.exampleTranslations ? ["text", "translation"] : ["text"],
      additionalProperties: false,
    },
    description: `${g.examplesCount} example sentences`,
  };
  if (g.grammar) properties["grammar"] = { type: "string", description: "Empty string if nothing notable" };
  if (x.mnemonic) properties["mnemonic"] = { type: "string", description: "One vivid memory hook, max 2 sentences" };
  if (x.etymology) properties["etymology"] = { type: "string", description: "Origin of the word in one sentence" };
  if (x.image) properties["imageQuery"] = { type: "string" };

  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}
