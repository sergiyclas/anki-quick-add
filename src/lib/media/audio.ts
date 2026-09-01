import type { AudioSourceId, Settings } from "../settings/schema";
import { fnv1a, slug } from "../text";
import { dictionaryApi } from "./dictionaryApi";
import { googleTts } from "./tts";
import type { AudioSource, MediaLookup, MediaResult } from "./types";
import { wiktionaryAudio } from "./wiktionaryAudio";

const SOURCES: Record<AudioSourceId, AudioSource> = { dictionary: dictionaryApi, wiktionary: wiktionaryAudio, tts: googleTts };

export function mediaBaseName(prefix: string, lang: string, word: string): string {
  return `${prefix}_${lang}_${slug(word)}_${fnv1a(word)}`;
}

// Walks the configured source order; a source that fails or finds nothing hands over to the next one.
export async function resolveAudio(word: string, settings: Settings): Promise<MediaResult | null> {
  if (!settings.media.audio.enabled) return null;
  const lang = settings.languages.source;
  const lookup: MediaLookup = { word, lang, baseName: mediaBaseName("aqa", lang, word), allowOgg: settings.media.audio.allowOgg };
  for (const id of settings.media.audio.order) {
    try {
      const result = await SOURCES[id].find(lookup);
      if (result) return result;
    } catch {
      // fall through to the next source
    }
  }
  return null;
}
