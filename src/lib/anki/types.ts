export interface MediaAttachment {
  filename: string;
  data: string; // base64
  fields: string[];
}

export interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
  options?: { allowDuplicate: boolean; duplicateScope: "collection" | "deck" };
  audio?: MediaAttachment[];
  picture?: MediaAttachment[];
}

export interface NoteUpdate {
  id: number;
  fields: Record<string, string>;
  audio?: MediaAttachment[];
  picture?: MediaAttachment[];
}

export interface NoteInfo {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
  cards: number[];
}

export type ModelTemplates = Record<string, { Front: string; Back: string }>;

export interface CardTemplate {
  Name: string;
  Front: string;
  Back: string;
}
