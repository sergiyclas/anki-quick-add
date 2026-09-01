import type { AnkiNote, MediaAttachment, NoteInfo, NoteUpdate } from "../anki/types";
import type { CardData, TextSlotId } from "../generation/types";
import type { MediaResult } from "../media/types";
import { BUILTIN_MODEL_NAME } from "../settings/schema";
import type { FieldMapping } from "./mapping";
import { renderSlot } from "./render";

export interface BuildOptions {
  deck: string;
  tags: string[];
  allowDuplicate: boolean;
  duplicateScope: "collection" | "deck";
  production: boolean;
}

function attachment(media: MediaResult, field: string): MediaAttachment {
  return { filename: media.filename, data: media.data, fields: [field] };
}

export function buildNote(card: CardData, media: MediaResult[], mapping: FieldMapping, opts: BuildOptions): AnkiNote {
  const fields: Record<string, string> = { ...mapping.staticFields };
  for (const [slot, field] of Object.entries(mapping.fields) as [TextSlotId, string | undefined][]) {
    if (field) fields[field] = renderSlot(slot, card, mapping.listFormat);
  }
  if (mapping.audioField) fields[mapping.audioField] = "";
  if (mapping.imageField) fields[mapping.imageField] = "";
  // The built-in note type generates its second (production) card only when Reverse is non-empty.
  if (opts.production && mapping.modelName === BUILTIN_MODEL_NAME) fields["Reverse"] = "y";

  const note: AnkiNote = {
    deckName: opts.deck,
    modelName: mapping.modelName,
    fields,
    tags: opts.tags,
    options: { allowDuplicate: opts.allowDuplicate, duplicateScope: opts.duplicateScope },
  };

  const audio = media.find((m) => m.kind === "audio");
  if (audio && mapping.audioField) note.audio = [attachment(audio, mapping.audioField)];
  const image = media.find((m) => m.kind === "image");
  if (image && mapping.imageField) {
    note.picture = [attachment(image, mapping.imageField)];
    if (image.credit && mapping.creditField) fields[mapping.creditField] = image.credit.html;
  }
  return note;
}

// For duplicate policy "update": fill only the fields that are empty on the existing note,
// and attach media only when its target field is empty.
export function buildUpdate(existing: NoteInfo, note: AnkiNote): NoteUpdate | null {
  const fields: Record<string, string> = {};
  for (const [field, value] of Object.entries(note.fields)) {
    if (value && existing.fields[field] && existing.fields[field].value.trim() === "") fields[field] = value;
  }
  const isEmpty = (field: string) => existing.fields[field]?.value.trim() === "";
  const audio = note.audio?.filter((a) => a.fields.every(isEmpty));
  const picture = note.picture?.filter((p) => p.fields.every(isEmpty));
  if (Object.keys(fields).length === 0 && !audio?.length && !picture?.length) return null;
  const update: NoteUpdate = { id: existing.noteId, fields };
  if (audio?.length) update.audio = audio;
  if (picture?.length) update.picture = picture;
  return update;
}
