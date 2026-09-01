import { bytesToBase64 } from "../base64";
import { HttpError, fetchBytes, fetchJson } from "../http";
import type { AudioSource } from "./types";

interface Entry {
  phonetics?: { text?: string; audio?: string }[];
}

// Ranks recordings: US first, then UK, then anything else.
export function pickDictionaryAudio(entries: Entry[]): string | null {
  const urls = entries.flatMap((e) => e.phonetics ?? []).map((p) => p.audio ?? "").filter((u) => u.endsWith(".mp3"));
  return urls.find((u) => u.includes("-us.")) ?? urls.find((u) => u.includes("-uk.")) ?? urls[0] ?? null;
}

// Community English dictionary with native recordings; English only.
export const dictionaryApi: AudioSource = {
  id: "dictionary",
  async find({ word, lang, baseName }) {
    if (lang !== "en") return null;
    let entries: Entry[];
    try {
      entries = await fetchJson<Entry[]>(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null;
      throw e;
    }
    const url = pickDictionaryAudio(entries);
    if (!url) return null;
    // The media host of this service is flaky; give up early so the next source gets its turn.
    const { bytes } = await fetchBytes(url, { timeoutMs: 8_000 });
    return { kind: "audio", filename: `${baseName}.mp3`, data: bytesToBase64(bytes), mime: "audio/mpeg", source: "dictionary" };
  },
};
