import { bytesToBase64 } from "../base64";
import { fetchBytes } from "../http";
import { languageByCode } from "../languages";
import type { AudioSource } from "./types";
import { WIKIMEDIA_HEADERS, extensionForMime, wikiApi } from "./wikimedia";

interface ImagesResponse {
  query?: { pages?: { title: string; imageinfo?: { url: string; mime: string }[] }[] };
}

export interface AudioCandidate {
  title: string;
  url: string;
  mime: string;
}

const FORMAT_RANK: Record<string, number> = { mp3: 0, wav: 1, ogg: 2 };

// Keeps recordings of the requested language and orders them by format preference.
// File names look like "En-us-hello.ogg", "De-Haus.ogg", "LL-Q1860 (eng)-User-hello.wav".
export function pickWiktionaryAudio(pages: { title: string; imageinfo?: { url: string; mime: string }[] }[], lang: string, allowOgg: boolean): AudioCandidate | null {
  const { iso3 } = languageByCode(lang);
  const prefix = `File:${lang.charAt(0).toUpperCase()}${lang.slice(1)}-`;
  const candidates: (AudioCandidate & { rank: number; us: number })[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const ext = extensionForMime(info.mime);
    if (!ext || !(ext in FORMAT_RANK)) continue;
    if (ext === "ogg" && !allowOgg) continue;
    const isLang = page.title.startsWith(prefix) || page.title.includes(`(${iso3})`);
    if (!isLang) continue;
    candidates.push({ title: page.title, url: info.url, mime: info.mime, rank: FORMAT_RANK[ext]!, us: /-us-/i.test(page.title) ? 0 : 1 });
  }
  candidates.sort((a, b) => a.rank - b.rank || a.us - b.us || a.title.localeCompare(b.title));
  const best = candidates[0];
  return best ? { title: best.title, url: best.url, mime: best.mime } : null;
}

export const wiktionaryAudio: AudioSource = {
  id: "wiktionary",
  async find({ word, lang, baseName, allowOgg }) {
    const res = await wikiApi<ImagesResponse>("en.wiktionary.org", {
      action: "query",
      titles: word,
      generator: "images",
      gimlimit: 50,
      prop: "imageinfo",
      iiprop: "url|mime",
    });
    const best = pickWiktionaryAudio(res.query?.pages ?? [], lang, allowOgg);
    if (!best) return null;
    const { bytes } = await fetchBytes(best.url, { headers: WIKIMEDIA_HEADERS });
    const ext = extensionForMime(best.mime)!;
    return { kind: "audio", filename: `${baseName}.${ext}`, data: bytesToBase64(bytes), mime: best.mime, source: "wiktionary" };
  },
};
