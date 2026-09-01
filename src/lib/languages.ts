export interface Language {
  code: string; // ISO 639-1
  name: string; // English name, used in prompts and UI
  tts: string; // Google TTS `tl` code
  iso3: string; // ISO 639-3, used to recognise Wiktionary/Lingua Libre audio file names
  ipaHint?: string; // accent to request in the transcription
  keepCase?: boolean; // nouns are capitalised (German): never lowercase the typed word
}

export const LANGUAGES: readonly Language[] = [
  { code: "en", name: "English", tts: "en", ipaHint: "General American", iso3: "eng" },
  { code: "uk", name: "Ukrainian", tts: "uk", iso3: "ukr" },
  { code: "de", name: "German", tts: "de", iso3: "deu", keepCase: true },
  { code: "fr", name: "French", tts: "fr", iso3: "fra" },
  { code: "es", name: "Spanish", tts: "es", iso3: "spa" },
  { code: "it", name: "Italian", tts: "it", iso3: "ita" },
  { code: "pt", name: "Portuguese", tts: "pt", iso3: "por" },
  { code: "pl", name: "Polish", tts: "pl", iso3: "pol" },
  { code: "cs", name: "Czech", tts: "cs", iso3: "ces" },
  { code: "sk", name: "Slovak", tts: "sk", iso3: "slk" },
  { code: "nl", name: "Dutch", tts: "nl", iso3: "nld" },
  { code: "sv", name: "Swedish", tts: "sv", iso3: "swe" },
  { code: "no", name: "Norwegian", tts: "no", iso3: "nor" },
  { code: "da", name: "Danish", tts: "da", iso3: "dan" },
  { code: "fi", name: "Finnish", tts: "fi", iso3: "fin" },
  { code: "el", name: "Greek", tts: "el", iso3: "ell" },
  { code: "tr", name: "Turkish", tts: "tr", iso3: "tur" },
  { code: "ro", name: "Romanian", tts: "ro", iso3: "ron" },
  { code: "hu", name: "Hungarian", tts: "hu", iso3: "hun" },
  { code: "bg", name: "Bulgarian", tts: "bg", iso3: "bul" },
  { code: "hr", name: "Croatian", tts: "hr", iso3: "hrv" },
  { code: "sr", name: "Serbian", tts: "sr", iso3: "srp" },
  { code: "sl", name: "Slovenian", tts: "sl", iso3: "slv" },
  { code: "lt", name: "Lithuanian", tts: "lt", iso3: "lit" },
  { code: "lv", name: "Latvian", tts: "lv", iso3: "lav" },
  { code: "et", name: "Estonian", tts: "et", iso3: "est" },
  { code: "ka", name: "Georgian", tts: "ka", iso3: "kat" },
  { code: "he", name: "Hebrew", tts: "iw", iso3: "heb" },
  { code: "ar", name: "Arabic", tts: "ar", iso3: "ara" },
  { code: "fa", name: "Persian", tts: "fa", iso3: "fas" },
  { code: "hi", name: "Hindi", tts: "hi", iso3: "hin" },
  { code: "bn", name: "Bengali", tts: "bn", iso3: "ben" },
  { code: "id", name: "Indonesian", tts: "id", iso3: "ind" },
  { code: "ms", name: "Malay", tts: "ms", iso3: "msa" },
  { code: "vi", name: "Vietnamese", tts: "vi", iso3: "vie" },
  { code: "th", name: "Thai", tts: "th", iso3: "tha" },
  { code: "zh", name: "Chinese (Mandarin)", tts: "zh-CN", iso3: "zho" },
  { code: "ja", name: "Japanese", tts: "ja", iso3: "jpn" },
  { code: "ko", name: "Korean", tts: "ko", iso3: "kor" },
  { code: "la", name: "Latin", tts: "la", iso3: "lat" },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

export function languageByCode(code: string): Language {
  return BY_CODE.get(code) ?? { code, name: code.toUpperCase(), tts: code, iso3: code };
}
