import { BUILTIN_FIELDS } from "../note/mapping";
import { BUILTIN_MODEL_NAME, type CardTheme } from "../settings/schema";
import type { AnkiClient } from "./client";
import type { CardTemplate } from "./types";

const FRONT_BLOCK = `<div class="word">{{Word}}</div>
{{#Transcription}}<div class="ipa">{{Transcription}}</div>{{/Transcription}}
<div class="audio">{{Audio}}</div>`;

const DETAILS_BLOCK = `{{#PartOfSpeech}}<div class="pos">{{PartOfSpeech}}</div>{{/PartOfSpeech}}
{{#Image}}<div class="image">{{Image}}</div>{{/Image}}
{{#Definition}}<div class="definition">{{Definition}}</div>{{/Definition}}
{{#Examples}}<div class="examples">{{Examples}}</div>{{/Examples}}
{{#ExamplesAudio}}<div class="examples-audio">{{ExamplesAudio}}</div>{{/ExamplesAudio}}
{{#Synonyms}}<div class="synonyms"><span class="label">Synonyms:</span> {{Synonyms}}</div>{{/Synonyms}}
{{#Grammar}}<div class="grammar">{{Grammar}}</div>{{/Grammar}}
{{#Mnemonic}}<div class="mnemonic"><span class="label">Remember:</span> {{Mnemonic}}</div>{{/Mnemonic}}
{{#Etymology}}<div class="etymology"><span class="label">Origin:</span> {{Etymology}}</div>{{/Etymology}}
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
${DETAILS_BLOCK.replace(/\{\{#PartOfSpeech\}\}[\s\S]*?\{\{\/PartOfSpeech\}\}\n/, "")}`,
  },
];

const BASE_CSS = `.card {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 20px;
  line-height: 1.45;
  text-align: center;
  padding: 12px;
}
.word { font-size: 34px; font-weight: 600; }
.ipa { font-size: 18px; margin-top: 2px; }
.audio { margin: 6px 0; }
.translation { font-size: 26px; margin: 10px 0 4px; }
.pos { font-size: 15px; font-style: italic; }
.definition { margin: 12px auto 0; max-width: 560px; }
.examples { text-align: left; max-width: 560px; margin: 16px auto 0; font-size: 17px; }
.examples > div, .examples > ul > li { margin: 6px 0; }
.examples .tr { font-size: 15px; margin-top: 1px; }
.examples-audio { margin-top: 6px; }
.synonyms, .mnemonic, .etymology { margin-top: 14px; font-size: 16px; max-width: 560px; margin-left: auto; margin-right: auto; }
.mnemonic { text-align: left; padding: 10px 14px; border-radius: 10px; }
.grammar { margin-top: 12px; font-size: 15px; }
.image img { max-width: 320px; max-height: 240px; border-radius: 8px; margin-top: 10px; }
.credit { margin-top: 10px; font-size: 11px; }
.credit a { color: inherit; }
hr#answer { border: none; border-top: 1px solid; margin: 14px 0; }`;

// Every theme shares the layout and only sets colours; night mode is handled inside each theme.
export const THEMES: Record<CardTheme, { label: string; css: string }> = {
  classic: {
    label: "Classic",
    css: `${BASE_CSS}
.card { color: #1f2328; background: #ffffff; }
.ipa, .pos, .grammar, .synonyms .label, .mnemonic .label, .etymology .label { color: #6b7280; }
.definition, .synonyms, .etymology, .examples .tr { color: #374151; }
.mnemonic { background: #fff7ed; color: #7c2d12; }
.credit { color: #9ca3af; }
hr#answer { border-top-color: #d0d7de; }
.night_mode .card, .nightMode .card { color: #e6e6e6; background: #1e1f22; }
.night_mode .definition, .night_mode .synonyms, .night_mode .etymology, .nightMode .definition, .nightMode .synonyms, .nightMode .etymology { color: #c9cdd2; }
.night_mode .mnemonic, .nightMode .mnemonic { background: #3a2a1a; color: #fed7aa; }
.night_mode hr#answer, .nightMode hr#answer { border-top-color: #3c3f44; }`,
  },
  paper: {
    label: "Paper",
    css: `${BASE_CSS}
.card { color: #2b2418; background: #f7f1e3; font-family: Georgia, "Times New Roman", serif; }
.word { font-weight: 700; letter-spacing: 0.01em; }
.ipa, .pos, .grammar, .credit { color: #8a7a5c; }
.translation { color: #7a2e0e; }
.definition, .synonyms, .etymology, .examples .tr { color: #4a4030; }
.synonyms .label, .mnemonic .label, .etymology .label { color: #8a7a5c; font-variant: small-caps; }
.mnemonic { background: #efe3c6; color: #4a3b12; }
.image img { border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
hr#answer { border-top-color: #d8ccb0; }
.night_mode .card, .nightMode .card { color: #e8dfc8; background: #2a241a; }
.night_mode .translation, .nightMode .translation { color: #f2a679; }
.night_mode .definition, .night_mode .synonyms, .night_mode .etymology, .nightMode .definition, .nightMode .synonyms, .nightMode .etymology { color: #cfc4a8; }
.night_mode .mnemonic, .nightMode .mnemonic { background: #3d3320; color: #f0e2bd; }
.night_mode hr#answer, .nightMode hr#answer { border-top-color: #4a4030; }`,
  },
  midnight: {
    label: "Midnight",
    css: `${BASE_CSS}
.card { color: #e8ecff; background: linear-gradient(160deg, #0f1734, #1a2a5c); }
.word { color: #ffffff; }
.ipa, .pos, .grammar, .credit { color: #9fb0e0; }
.translation { color: #ff9b7a; }
.definition, .synonyms, .etymology, .examples .tr { color: #c7d0f0; }
.synonyms .label, .mnemonic .label, .etymology .label { color: #7ea6ff; }
.mnemonic { background: rgba(255, 255, 255, 0.08); color: #ffe6d6; }
.image img { box-shadow: 0 8px 24px rgba(0,0,0,.35); }
hr#answer { border-top-color: rgba(255,255,255,.18); }`,
  },
};

export const BUILTIN_CSS = THEMES.classic.css;

// Creates the built-in note type once, and adds any fields introduced by newer versions to an existing one
// (templates are refreshed in that case so the new fields render). Returns true when something changed.
export async function ensureBuiltinModel(client: AnkiClient): Promise<boolean> {
  const names = await client.modelNames();
  if (!names.includes(BUILTIN_MODEL_NAME)) {
    await client.createModel(BUILTIN_MODEL_NAME, [...BUILTIN_FIELDS], BUILTIN_TEMPLATES, BUILTIN_CSS);
    return true;
  }
  const existing = await client.modelFieldNames(BUILTIN_MODEL_NAME);
  const missing = BUILTIN_FIELDS.filter((f) => !existing.includes(f));
  if (!missing.length) return false;
  for (const field of missing) await client.modelFieldAdd(BUILTIN_MODEL_NAME, field);
  await client.updateModelTemplates(BUILTIN_MODEL_NAME, Object.fromEntries(BUILTIN_TEMPLATES.map((t) => [t.Name, { Front: t.Front, Back: t.Back }])));
  return true;
}

export async function applyTheme(client: AnkiClient, theme: CardTheme): Promise<void> {
  await ensureBuiltinModel(client);
  await client.updateModelStyling(BUILTIN_MODEL_NAME, THEMES[theme].css);
}
