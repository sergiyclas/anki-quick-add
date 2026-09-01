import { fetchJson } from "../../http";
import { languageByCode } from "../../languages";

// The unofficial Google Translate endpoint answers with a positional array. Besides the translation
// (dt=t) it can return dictionary alternatives with parts of speech (dt=bd), synonyms (dt=ss),
// definitions (dt=md) and example sentences (dt=ex). Positions are not documented, so every part is
// recognised by its shape rather than its index; anything unrecognised is simply left empty.
const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

export interface GtxResult {
  translation: string;
  alternatives: { partOfSpeech: string; terms: string[] }[];
  synonyms: string[];
  definitions: { partOfSpeech: string; text: string }[];
  examples: string[];
}

const isStr = (v: unknown): v is string => typeof v === "string";
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

// dt=bd: [[pos, [term, ...], [[term, [back-translations], null, score], ...], base, posId], ...]
function parseDictionary(part: unknown): GtxResult["alternatives"] {
  if (!isArr(part)) return [];
  const out: GtxResult["alternatives"] = [];
  for (const entry of part) {
    if (!isArr(entry) || !isStr(entry[0]) || !isArr(entry[1])) continue;
    const terms = entry[1].filter(isStr);
    if (terms.length) out.push({ partOfSpeech: entry[0], terms });
  }
  return out;
}

// dt=ss: [[pos, [[syn, syn, ...], id], ...], ...]
function parseSynonyms(part: unknown): string[] {
  if (!isArr(part)) return [];
  const out: string[] = [];
  for (const entry of part) {
    if (!isArr(entry) || !isStr(entry[0]) || !isArr(entry[1])) continue;
    for (const group of entry[1]) {
      if (!isArr(group) || !isArr(group[0])) continue;
      // group[2] carries usage labels such as [["archaic"]]; those synonyms would mislead a learner.
      const labels = isArr(group[2]) ? group[2].flat().filter(isStr) : [];
      if (labels.some((l) => /archaic|rare|dated|obsolete/i.test(l))) continue;
      out.push(...group[0].filter(isStr));
    }
  }
  return out;
}

// dt=md: [[pos, [[definition, id, example?], ...]], ...]
function parseDefinitions(part: unknown): GtxResult["definitions"] {
  if (!isArr(part)) return [];
  const out: GtxResult["definitions"] = [];
  for (const entry of part) {
    if (!isArr(entry) || !isStr(entry[0]) || !isArr(entry[1])) continue;
    for (const def of entry[1]) {
      if (isArr(def) && isStr(def[0])) out.push({ partOfSpeech: entry[0], text: def[0] });
    }
  }
  return out;
}

// dt=ex: [[[sentence-with-<b>-markup, ...], ...]]
function parseExamples(part: unknown): string[] {
  if (!isArr(part) || !isArr(part[0])) return [];
  const out: string[] = [];
  for (const ex of part[0]) {
    if (isArr(ex) && isStr(ex[0])) out.push(stripTags(ex[0]));
  }
  return out;
}

function looksLikeExamples(part: unknown): boolean {
  return isArr(part) && isArr(part[0]) && isArr(part[0][0]) && isStr(part[0][0][0]) && /<b>/.test(part[0][0][0]);
}

function looksLikeDefinitions(part: unknown): boolean {
  if (!isArr(part) || !isArr(part[0])) return false;
  const [pos, defs] = part[0];
  return isStr(pos) && isArr(defs) && isArr(defs[0]) && isStr(defs[0][0]) && !isArr(defs[0][1] ?? null);
}

function looksLikeSynonyms(part: unknown): boolean {
  if (!isArr(part) || !isArr(part[0])) return false;
  const [pos, groups] = part[0];
  return isStr(pos) && isArr(groups) && isArr(groups[0]) && isArr(groups[0][0]);
}

export function parseGtxFull(data: unknown): GtxResult {
  const result: GtxResult = { translation: "", alternatives: [], synonyms: [], definitions: [], examples: [] };
  if (!isArr(data)) return result;
  const [t, bd, ...rest] = data;
  if (isArr(t)) result.translation = t.map((s) => (isArr(s) && isStr(s[0]) ? s[0] : "")).join("").trim();
  result.alternatives = parseDictionary(bd);
  for (const part of rest) {
    if (!result.examples.length && looksLikeExamples(part)) result.examples = parseExamples(part);
    else if (!result.synonyms.length && looksLikeSynonyms(part)) result.synonyms = parseSynonyms(part);
    else if (!result.definitions.length && looksLikeDefinitions(part)) result.definitions = parseDefinitions(part);
  }
  return result;
}

export async function gtxLookup(text: string, source: string, target: string): Promise<GtxResult> {
  // hl=en keeps part-of-speech labels in English regardless of the target language.
  const params = new URLSearchParams({ client: "gtx", sl: languageByCode(source).tts, tl: languageByCode(target).tts, hl: "en", q: text });
  for (const dt of ["t", "bd", "ss", "md", "ex"]) params.append("dt", dt);
  return parseGtxFull(await fetchJson<unknown>(`${ENDPOINT}?${params}`, { timeoutMs: 8_000 }));
}
