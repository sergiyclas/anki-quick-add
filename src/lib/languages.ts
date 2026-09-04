export interface Language {
  code: string; // ISO 639-1
  name: string; // English name, used in prompts and UI
  tts: string; // Google TTS `tl` code
  iso3: string; // ISO 639-3, used to recognise Wiktionary/Lingua Libre audio file names
  ipaHint?: string; // accent to request in the transcription
  keepCase?: boolean; // nouns are capitalised (German): never lowercase the typed word
  sample: string; // an everyday word in this language, used to test the offline translator
}

export const LANGUAGES: readonly Language[] = [
  { code: "en", name: "English", tts: "en", ipaHint: "General American", iso3: "eng", sample: "lighthouse" },
  { code: "uk", name: "Ukrainian", tts: "uk", iso3: "ukr", sample: "маяк" },
  { code: "de", name: "German", tts: "de", iso3: "deu", keepCase: true, sample: "Leuchtturm" },
  { code: "fr", name: "French", tts: "fr", iso3: "fra", sample: "phare" },
  { code: "es", name: "Spanish", tts: "es", iso3: "spa", sample: "faro" },
  { code: "it", name: "Italian", tts: "it", iso3: "ita", sample: "faro" },
  { code: "pt", name: "Portuguese", tts: "pt", iso3: "por", sample: "farol" },
  { code: "pl", name: "Polish", tts: "pl", iso3: "pol", sample: "latarnia" },
  { code: "cs", name: "Czech", tts: "cs", iso3: "ces", sample: "maják" },
  { code: "sk", name: "Slovak", tts: "sk", iso3: "slk", sample: "maják" },
  { code: "nl", name: "Dutch", tts: "nl", iso3: "nld", sample: "vuurtoren" },
  { code: "sv", name: "Swedish", tts: "sv", iso3: "swe", sample: "fyr" },
  { code: "no", name: "Norwegian", tts: "no", iso3: "nor", sample: "fyr" },
  { code: "da", name: "Danish", tts: "da", iso3: "dan", sample: "fyrtårn" },
  { code: "fi", name: "Finnish", tts: "fi", iso3: "fin", sample: "majakka" },
  { code: "el", name: "Greek", tts: "el", iso3: "ell", sample: "φάρος" },
  { code: "tr", name: "Turkish", tts: "tr", iso3: "tur", sample: "deniz feneri" },
  { code: "ro", name: "Romanian", tts: "ro", iso3: "ron", sample: "far" },
  { code: "hu", name: "Hungarian", tts: "hu", iso3: "hun", sample: "világítótorony" },
  { code: "bg", name: "Bulgarian", tts: "bg", iso3: "bul", sample: "фар" },
  { code: "hr", name: "Croatian", tts: "hr", iso3: "hrv", sample: "svjetionik" },
  { code: "sr", name: "Serbian", tts: "sr", iso3: "srp", sample: "светионик" },
  { code: "sl", name: "Slovenian", tts: "sl", iso3: "slv", sample: "svetilnik" },
  { code: "lt", name: "Lithuanian", tts: "lt", iso3: "lit", sample: "švyturys" },
  { code: "lv", name: "Latvian", tts: "lv", iso3: "lav", sample: "bāka" },
  { code: "et", name: "Estonian", tts: "et", iso3: "est", sample: "tuletorn" },
  { code: "ka", name: "Georgian", tts: "ka", iso3: "kat", sample: "შუქურა" },
  { code: "he", name: "Hebrew", tts: "iw", iso3: "heb", sample: "מגדלור" },
  { code: "ar", name: "Arabic", tts: "ar", iso3: "ara", sample: "منارة" },
  { code: "fa", name: "Persian", tts: "fa", iso3: "fas", sample: "فانوس دریایی" },
  { code: "hi", name: "Hindi", tts: "hi", iso3: "hin", sample: "प्रकाशस्तंभ" },
  { code: "bn", name: "Bengali", tts: "bn", iso3: "ben", sample: "বাতিঘর" },
  { code: "id", name: "Indonesian", tts: "id", iso3: "ind", sample: "mercusuar" },
  { code: "ms", name: "Malay", tts: "ms", iso3: "msa", sample: "rumah api" },
  { code: "vi", name: "Vietnamese", tts: "vi", iso3: "vie", sample: "hải đăng" },
  { code: "th", name: "Thai", tts: "th", iso3: "tha", sample: "ประภาคาร" },
  { code: "zh", name: "Chinese (Mandarin)", tts: "zh-CN", iso3: "zho", sample: "灯塔" },
  { code: "ja", name: "Japanese", tts: "ja", iso3: "jpn", sample: "灯台" },
  { code: "ko", name: "Korean", tts: "ko", iso3: "kor", sample: "등대" },
  { code: "la", name: "Latin", tts: "la", iso3: "lat", sample: "pharus" },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

export function languageByCode(code: string): Language {
  return BY_CODE.get(code) ?? { code, name: code.toUpperCase(), tts: code, iso3: code, sample: "hello" };
}
