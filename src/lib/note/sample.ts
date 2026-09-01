import type { CardData } from "../generation/types";
import { languageByCode } from "../languages";
import type { Settings } from "../settings/schema";
import { buildNote } from "./builder";
import type { FieldMapping } from "./mapping";
import { buildTags } from "./tags";

const SAMPLE_EN_UK: CardData = {
  word: "queue",
  translations: ["черга", "черга (у комп'ютерних системах)"],
  transcription: "/kjuː/",
  partOfSpeech: "noun",
  definition: "A line of people or vehicles waiting for something.",
  synonyms: ["line", "row", "waiting line"],
  examples: [
    { text: "We waited in a queue for almost an hour.", translation: "Ми простояли в черзі майже годину." },
    { text: "Please join the queue at the back.", translation: "Будь ласка, станьте в чергу з кінця." },
    { text: "All write operations are queued to the device.", translation: "Усі операції запису ставляться в чергу до пристрою." },
  ],
  grammar: "countable noun; plural: queues. Also a verb: to queue (up).",
};

// Sample data for the preview; en→uk gets a real example, other pairs a labelled placeholder.
export function sampleCard(settings: Settings): CardData {
  if (settings.languages.source === "en" && settings.languages.target === "uk") return SAMPLE_EN_UK;
  const target = languageByCode(settings.languages.target).name;
  return {
    ...SAMPLE_EN_UK,
    translations: [`(${target} translation)`, `(second ${target} translation)`],
    examples: SAMPLE_EN_UK.examples.map((e) => ({ text: e.text, translation: `(${target} translation)` })),
  };
}

const SAMPLE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" rx="12" fill="#c7d7f2"/><text x="160" y="108" font-family="system-ui" font-size="22" text-anchor="middle" fill="#2f4a7a">sample image</text></svg>`,
  );

// Field values exactly as the pipeline would store them, with placeholder media in the media fields.
export function samplePreviewFields(settings: Settings, mapping: FieldMapping): Record<string, string> {
  const card = sampleCard(settings);
  const note = buildNote(card, [], mapping, {
    deck: settings.anki.deck,
    tags: buildTags(settings),
    allowDuplicate: false,
    duplicateScope: settings.anki.dedupeScope,
    production: settings.anki.production,
  });
  const fields = { ...note.fields };
  if (mapping.audioField && settings.media.audio.enabled) fields[mapping.audioField] = "[sound:sample.mp3]";
  if (mapping.imageField && settings.media.image.enabled) fields[mapping.imageField] = `<img src="${SAMPLE_IMAGE}">`;
  if (mapping.creditField && settings.media.image.enabled && settings.media.image.storeCredit) {
    fields[mapping.creditField] = 'Sample Author · CC BY-SA 4.0 · <a href="#">Wikimedia Commons</a>';
  }
  return fields;
}
