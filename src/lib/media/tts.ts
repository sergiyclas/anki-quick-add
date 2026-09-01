import { bytesToBase64 } from "../base64";
import { fetchBytes } from "../http";
import { languageByCode } from "../languages";
import type { AudioSource } from "./types";

// Unofficial Google Translate TTS endpoint: no key, every language, may disappear without notice.
export const googleTts: AudioSource = {
  id: "tts",
  async find({ word, lang, baseName }) {
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob" +
      `&tl=${encodeURIComponent(languageByCode(lang).tts)}&q=${encodeURIComponent(word)}`;
    const { bytes } = await fetchBytes(url);
    if (bytes.byteLength === 0) return null;
    return { kind: "audio", filename: `${baseName}.mp3`, data: bytesToBase64(bytes), mime: "audio/mpeg", source: "tts" };
  },
};
