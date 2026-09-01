import { expect, test } from "vitest";
import type { NoteInfo } from "../src/lib/anki/types";
import type { CardData } from "../src/lib/generation/types";
import { buildNote, buildUpdate } from "../src/lib/note/builder";
import { defaultMappingForBuiltin, legacyMappingV1, validateMapping } from "../src/lib/note/mapping";
import { buildTags } from "../src/lib/note/tags";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schema";

const card: CardData = {
  word: "queue",
  translations: ["черга", "чергування"],
  transcription: "/kjuː/",
  synonyms: ["line", "row"],
  examples: [{ text: "We waited in a queue." }, { text: "Join <the> queue.", translation: "Стань у чергу." }],
  grammar: "countable noun",
};
const audio = { kind: "audio" as const, filename: "aqa_en_queue_abc123.mp3", data: "QUJD", mime: "audio/mpeg", source: "tts" };
const opts = { deck: "My learning", tags: ["quick-add"], allowDuplicate: false, duplicateScope: "collection" as const, production: false };

test("legacy v1 mapping reproduces the v1 note shape", () => {
  const note = buildNote(card, [audio], legacyMappingV1("My cards_en-uk"), opts);
  expect(note.modelName).toBe("My cards_en-uk");
  expect(note.fields).toEqual({
    En: "queue",
    Uk: "черга, чергування",
    IPA: "/kjuː/",
    Desc: "line, row",
    Samples: '<div>We waited in a queue.</div><div>Join &lt;the&gt; queue.<div class="tr">Стань у чергу.</div></div>',
    Order: "",
    Sound: "",
  });
  expect(note.audio).toEqual([{ filename: "aqa_en_queue_abc123.mp3", data: "QUJD", fields: ["Sound"] }]);
  expect(note.picture).toBeUndefined();
  expect(note.options).toEqual({ allowDuplicate: false, duplicateScope: "collection" });
});

test("built-in mapping sets Reverse only when production is on", () => {
  const mapping = defaultMappingForBuiltin();
  expect(buildNote(card, [], mapping, opts).fields["Reverse"]).toBeUndefined();
  expect(buildNote(card, [], mapping, { ...opts, production: true }).fields["Reverse"]).toBe("y");
  expect(buildNote(card, [], mapping, opts).fields["Grammar"]).toBe("countable noun");
});

test("validateMapping reports unknown, missing and doubly-used fields", () => {
  const fields = ["En", "Uk", "IPA", "Order", "Sound", "Desc", "Samples"];
  expect(validateMapping(legacyMappingV1("m"), fields)).toEqual([]);
  const broken = { ...legacyMappingV1("m"), fields: { word: "En", translations: "En", synonyms: "Nope" }, dedupeField: "" };
  expect(validateMapping(broken, fields)).toEqual([
    "A duplicate-check field must be selected",
    'Field "En" is used by both word and translations',
    'Field "Nope" (slot synonyms) does not exist in the note type',
  ]);
});

test("buildUpdate fills only empty fields and attaches media only to empty targets", () => {
  const note = buildNote(card, [audio], legacyMappingV1("My cards_en-uk"), opts);
  const existing: NoteInfo = {
    noteId: 42,
    modelName: "My cards_en-uk",
    tags: [],
    cards: [1],
    fields: {
      En: { value: "queue", order: 0 },
      Uk: { value: "черга", order: 1 },
      IPA: { value: "", order: 2 },
      Order: { value: "", order: 3 },
      Sound: { value: "[sound:old.mp3]", order: 4 },
      Desc: { value: "  ", order: 5 },
      Samples: { value: "", order: 6 },
    },
  };
  const update = buildUpdate(existing, note);
  expect(update).toEqual({
    id: 42,
    fields: { IPA: "/kjuː/", Desc: "line, row", Samples: note.fields["Samples"] },
  });
  const fullyFilled = {
    ...existing,
    fields: Object.fromEntries(Object.entries(existing.fields).map(([k, v]) => [k, { ...v, value: v.value.trim() || "x" }])),
  };
  expect(buildUpdate(fullyFilled, note)).toBeNull();
});

test("tags include user tags, the marker and the language pair", () => {
  expect(buildTags(DEFAULT_SETTINGS, ["extra", " "])).toEqual(["quick-add", "extra", "aqa", "en-uk"]);
  expect(buildTags({ ...DEFAULT_SETTINGS, anki: { ...DEFAULT_SETTINGS.anki, autoLangTag: false, tags: [] } })).toEqual(["aqa"]);
});
