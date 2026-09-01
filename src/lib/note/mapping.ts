import type { TextSlotId } from "../generation/types";
import { BUILTIN_MODEL_NAME } from "../settings/schema";

export interface ListFormat {
  translations: "comma" | "lines";
  synonyms: "comma" | "lines";
  examples: "lines" | "list";
}

export interface FieldMapping {
  modelName: string;
  fields: Partial<Record<TextSlotId, string>>;
  staticFields: Record<string, string>;
  dedupeField: string;
  audioField?: string;
  imageField?: string;
  creditField?: string;
  listFormat: ListFormat;
}

export const DEFAULT_LIST_FORMAT: ListFormat = { translations: "comma", synonyms: "comma", examples: "lines" };

export const BUILTIN_FIELDS = [
  "Word",
  "Translation",
  "Transcription",
  "PartOfSpeech",
  "Definition",
  "Synonyms",
  "Examples",
  "Grammar",
  "Audio",
  "Image",
  "ImageCredit",
  "Reverse",
] as const;

export function defaultMappingForBuiltin(): FieldMapping {
  return {
    modelName: BUILTIN_MODEL_NAME,
    fields: {
      word: "Word",
      translations: "Translation",
      transcription: "Transcription",
      partOfSpeech: "PartOfSpeech",
      definition: "Definition",
      synonyms: "Synonyms",
      examples: "Examples",
      grammar: "Grammar",
    },
    staticFields: {},
    dedupeField: "Word",
    audioField: "Audio",
    imageField: "Image",
    creditField: "ImageCredit",
    listFormat: { ...DEFAULT_LIST_FORMAT },
  };
}

// Mapping for the v1 hard-coded note type (En/Uk/IPA/Order/Sound/Desc/Samples).
export function legacyMappingV1(modelName: string): FieldMapping {
  return {
    modelName,
    fields: { word: "En", translations: "Uk", transcription: "IPA", synonyms: "Desc", examples: "Samples" },
    staticFields: { Order: "" },
    dedupeField: "En",
    audioField: "Sound",
    listFormat: { ...DEFAULT_LIST_FORMAT },
  };
}

// A mapping for an unknown note type: first field gets the word, second the translation.
export function guessMapping(modelName: string, fieldNames: string[]): FieldMapping {
  const [first, second] = fieldNames;
  return {
    modelName,
    fields: { ...(first ? { word: first } : {}), ...(second ? { translations: second } : {}) },
    staticFields: {},
    dedupeField: first ?? "",
    listFormat: { ...DEFAULT_LIST_FORMAT },
  };
}

// Mapping to use when none is stored: the built-in layout, or the v1 layout if the note type has those fields.
export function resolveDefaultMapping(modelName: string, fieldNames: string[]): FieldMapping | null {
  if (modelName === BUILTIN_MODEL_NAME) return defaultMappingForBuiltin();
  const legacy = legacyMappingV1(modelName);
  const needed = [...Object.values(legacy.fields), legacy.audioField, ...Object.keys(legacy.staticFields)];
  return needed.every((f) => f && fieldNames.includes(f)) ? legacy : null;
}

export function validateMapping(mapping: FieldMapping, fieldNames: string[]): string[] {
  const errors: string[] = [];
  const known = new Set(fieldNames);
  if (!mapping.fields.word) errors.push("The 'word' slot must be mapped to a field");
  if (!mapping.dedupeField) errors.push("A duplicate-check field must be selected");
  else if (!known.has(mapping.dedupeField)) errors.push(`Duplicate-check field "${mapping.dedupeField}" does not exist`);

  const used = new Map<string, string>();
  for (const [slot, field] of Object.entries(mapping.fields)) {
    if (!field) continue;
    if (!known.has(field)) errors.push(`Field "${field}" (slot ${slot}) does not exist in the note type`);
    const prev = used.get(field);
    if (prev) errors.push(`Field "${field}" is used by both ${prev} and ${slot}`);
    used.set(field, slot);
  }
  for (const [name, field] of [
    ["audio", mapping.audioField],
    ["image", mapping.imageField],
    ["image credit", mapping.creditField],
  ] as const) {
    if (field && !known.has(field)) errors.push(`${name} field "${field}" does not exist in the note type`);
  }
  for (const field of Object.keys(mapping.staticFields)) {
    if (!known.has(field)) errors.push(`Static field "${field}" does not exist in the note type`);
  }
  return errors;
}
