import type { GenerationSettings } from "../settings/schema";
import type { JsonSchema } from "./types";

// One schema for every provider's strict mode: all properties required, additionalProperties:false,
// no min*/max* keywords (Anthropic rejects minItems/maxItems). Counts are enforced by the prompt
// and by normalizeCardData().
export function buildCardSchema(g: GenerationSettings, imageOn: boolean): JsonSchema {
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
  if (imageOn) properties["imageQuery"] = { type: "string" };

  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}
