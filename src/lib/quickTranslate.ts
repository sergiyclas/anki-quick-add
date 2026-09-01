import { fetchJson } from "./http";
import { languageByCode } from "./languages";

// Free, unofficial Google Translate endpoint (the same one Quick Anki Adder uses): instant and keyless,
// so the bubble and the popup can show a translation before any LLM call. May disappear without notice.
const ENDPOINT = "https://translate.googleapis.com/translate_a/single";
const CACHE_LIMIT = 200;
const cache = new Map<string, string>();

type GtxResponse = [Array<[string, string, ...unknown[]]> | null, ...unknown[]];

export function parseGtx(data: unknown): string {
  const sentences = (data as GtxResponse)?.[0];
  if (!Array.isArray(sentences)) return "";
  return sentences
    .map((s) => (Array.isArray(s) && typeof s[0] === "string" ? s[0] : ""))
    .join("")
    .trim();
}

export async function quickTranslate(text: string, source: string, target: string): Promise<string> {
  const key = `${source}|${target}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const params = new URLSearchParams({
    client: "gtx",
    sl: languageByCode(source).tts,
    tl: languageByCode(target).tts,
    dt: "t",
    q: text,
  });
  const translation = parseGtx(await fetchJson<unknown>(`${ENDPOINT}?${params}`, { timeoutMs: 6_000 }));
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, translation);
  return translation;
}
