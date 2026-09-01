import { fetchJson } from "../../http";
import { languageByCode } from "../../languages";

// Tatoeba: a free, CC-licensed corpus of example sentences with translations. No key, ISO 639-3 codes.
const ENDPOINT = "https://tatoeba.org/en/api_v0/search";
const HEADERS = { "Api-User-Agent": "AnkiQuickAdd/2.0 (Chrome extension)" };

interface SearchResponse {
  results?: { text: string; translations?: { text: string; lang: string }[][] }[];
}

export interface TatoebaExample {
  text: string;
  translation?: string;
}

export function pickTatoebaExamples(res: SearchResponse, word: string, targetIso3: string, limit: number): TatoebaExample[] {
  const needle = word.toLowerCase();
  const out: TatoebaExample[] = [];
  for (const r of res.results ?? []) {
    const text = r.text?.trim();
    if (!text || !text.toLowerCase().includes(needle) || text.length > 160) continue;
    const translation = (r.translations ?? []).flat().find((t) => t.lang === targetIso3)?.text?.trim();
    out.push(translation ? { text, translation } : { text });
    if (out.length >= limit) break;
  }
  // Prefer sentences that come with a translation.
  return out.sort((a, b) => Number(Boolean(b.translation)) - Number(Boolean(a.translation)));
}

export async function tatoebaExamples(word: string, source: string, target: string, limit: number): Promise<TatoebaExample[]> {
  const from = languageByCode(source).iso3;
  const to = languageByCode(target).iso3;
  const query = (withTarget: boolean) =>
    `${ENDPOINT}?${new URLSearchParams({ from, query: word, sort: "relevance", ...(withTarget ? { to } : {}) })}`;
  const withTranslations = await fetchJson<SearchResponse>(query(true), { headers: HEADERS }).catch(() => ({}) as SearchResponse);
  let examples = pickTatoebaExamples(withTranslations, word, to, limit);
  if (examples.length < limit) {
    const any = await fetchJson<SearchResponse>(query(false), { headers: HEADERS }).catch(() => ({}) as SearchResponse);
    const seen = new Set(examples.map((e) => e.text));
    for (const e of pickTatoebaExamples(any, word, to, limit)) {
      if (examples.length >= limit) break;
      if (!seen.has(e.text)) examples.push(e);
    }
  }
  return examples.slice(0, limit);
}
