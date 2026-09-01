export type TextSlotId =
  | "word"
  | "translations"
  | "transcription"
  | "partOfSpeech"
  | "definition"
  | "synonyms"
  | "examples"
  | "grammar"
  | "context";

export type SlotId = TextSlotId | "imageQuery" | "audio" | "image" | "imageCredit";

export interface ExampleItem {
  text: string;
  translation?: string;
}

export interface CardData {
  word: string;
  translations: string[];
  transcription?: string;
  partOfSpeech?: string;
  definition?: string;
  synonyms?: string[];
  examples: ExampleItem[];
  grammar?: string;
  imageQuery?: string;
  context?: string;
}

export type JsonSchema =
  | {
      type: "object";
      properties: Record<string, JsonSchema>;
      required: string[];
      additionalProperties: false;
      description?: string;
    }
  | { type: "array"; items: JsonSchema; description?: string }
  | { type: "string" | "number" | "integer" | "boolean"; description?: string; enum?: string[] };
