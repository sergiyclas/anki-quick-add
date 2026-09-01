import { BUILTIN_FIELDS } from "../note/mapping";
import { BUILTIN_MODEL_NAME } from "../settings/schema";
import type { AnkiClient } from "./client";
import type { CardTemplate } from "./types";

const FRONT_BLOCK = `<div class="word">{{Word}}</div>
{{#Transcription}}<div class="ipa">{{Transcription}}</div>{{/Transcription}}
<div class="audio">{{Audio}}</div>`;

const DETAILS_BLOCK = `{{#PartOfSpeech}}<div class="pos">{{PartOfSpeech}}</div>{{/PartOfSpeech}}
{{#Image}}<div class="image">{{Image}}</div>{{/Image}}
{{#Definition}}<div class="definition">{{Definition}}</div>{{/Definition}}
{{#Examples}}<div class="examples">{{Examples}}</div>{{/Examples}}
{{#Synonyms}}<div class="synonyms"><span class="label">Synonyms:</span> {{Synonyms}}</div>{{/Synonyms}}
{{#Grammar}}<div class="grammar">{{Grammar}}</div>{{/Grammar}}
{{#ImageCredit}}<div class="credit">{{ImageCredit}}</div>{{/ImageCredit}}`;

export const BUILTIN_TEMPLATES: CardTemplate[] = [
  {
    Name: "Recognition",
    Front: FRONT_BLOCK,
    Back: `{{FrontSide}}
<hr id="answer">
<div class="translation">{{Translation}}</div>
${DETAILS_BLOCK}`,
  },
  {
    // Generated only when Reverse is non-empty (same pattern as Anki's "Basic (optional reversed card)").
    Name: "Production",
    Front: `{{#Reverse}}<div class="translation">{{Translation}}</div>
{{#PartOfSpeech}}<div class="pos">{{PartOfSpeech}}</div>{{/PartOfSpeech}}{{/Reverse}}`,
    Back: `{{FrontSide}}
<hr id="answer">
${FRONT_BLOCK}
{{#Image}}<div class="image">{{Image}}</div>{{/Image}}
{{#Definition}}<div class="definition">{{Definition}}</div>{{/Definition}}
{{#Examples}}<div class="examples">{{Examples}}</div>{{/Examples}}
{{#Synonyms}}<div class="synonyms"><span class="label">Synonyms:</span> {{Synonyms}}</div>{{/Synonyms}}
{{#Grammar}}<div class="grammar">{{Grammar}}</div>{{/Grammar}}
{{#ImageCredit}}<div class="credit">{{ImageCredit}}</div>{{/ImageCredit}}`,
  },
];

export const BUILTIN_CSS = `.card {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 20px;
  line-height: 1.45;
  text-align: center;
  color: #1f2328;
  background: #ffffff;
  padding: 12px;
}
.word { font-size: 34px; font-weight: 600; }
.ipa { color: #6b7280; font-size: 18px; margin-top: 2px; }
.audio { margin: 6px 0; }
.translation { font-size: 26px; margin: 10px 0 4px; }
.pos { color: #6b7280; font-size: 15px; font-style: italic; }
.definition { margin: 12px auto 0; max-width: 560px; color: #374151; }
.examples { text-align: left; max-width: 560px; margin: 16px auto 0; font-size: 17px; }
.examples > div, .examples > ul > li { margin: 6px 0; }
.examples .tr { color: #6b7280; font-size: 15px; margin-top: 1px; }
.synonyms { margin-top: 14px; font-size: 16px; color: #374151; }
.synonyms .label { color: #6b7280; }
.grammar { margin-top: 12px; font-size: 15px; color: #6b7280; }
.image img { max-width: 320px; max-height: 240px; border-radius: 8px; margin-top: 10px; }
.credit { margin-top: 10px; font-size: 11px; color: #9ca3af; }
.credit a { color: inherit; }
hr#answer { border: none; border-top: 1px solid #d0d7de; margin: 14px 0; }
.night_mode .card, .nightMode .card { color: #e6e6e6; background: #1e1f22; }
.night_mode .definition, .night_mode .synonyms, .nightMode .definition, .nightMode .synonyms { color: #c9cdd2; }
.night_mode hr#answer, .nightMode hr#answer { border-top-color: #3c3f44; }`;

// Creates the built-in note type once; returns true when it was created by this call.
export async function ensureBuiltinModel(client: AnkiClient): Promise<boolean> {
  const names = await client.modelNames();
  if (names.includes(BUILTIN_MODEL_NAME)) return false;
  await client.createModel(BUILTIN_MODEL_NAME, [...BUILTIN_FIELDS], BUILTIN_TEMPLATES, BUILTIN_CSS);
  return true;
}
