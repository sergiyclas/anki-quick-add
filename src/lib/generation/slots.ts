import type { Settings } from "../settings/schema";
import type { SlotId, TextSlotId } from "./types";

export interface SlotDef {
  id: SlotId;
  enabled(settings: Settings): boolean;
}

// Text slots can be mapped onto note fields; media slots go through the mapping's audio/image/credit fields.
export const TEXT_SLOTS: readonly { id: TextSlotId; enabled(settings: Settings): boolean }[] = [
  { id: "word", enabled: () => true },
  { id: "translations", enabled: () => true },
  { id: "transcription", enabled: (s) => s.generation.transcription },
  { id: "partOfSpeech", enabled: (s) => s.generation.partOfSpeech },
  { id: "definition", enabled: (s) => s.generation.definition },
  { id: "synonyms", enabled: (s) => s.generation.synonyms },
  { id: "examples", enabled: () => true },
  { id: "grammar", enabled: (s) => s.generation.grammar },
  { id: "context", enabled: () => true },
];

export const MEDIA_SLOTS: readonly SlotDef[] = [
  { id: "audio", enabled: (s) => s.media.audio.enabled },
  { id: "image", enabled: (s) => s.media.image.enabled },
  { id: "imageCredit", enabled: (s) => s.media.image.enabled && s.media.image.storeCredit },
];

export function enabledTextSlots(settings: Settings): TextSlotId[] {
  return TEXT_SLOTS.filter((s) => s.enabled(settings)).map((s) => s.id);
}
