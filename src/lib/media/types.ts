export interface MediaCredit {
  html: string;
  license?: string;
  url?: string;
}

export interface MediaResult {
  kind: "audio" | "image";
  role?: "pronunciation" | "example"; // audio only; default pronunciation
  filename: string;
  data: string; // base64
  mime: string;
  source: string;
  credit?: MediaCredit;
}

export interface MediaLookup {
  word: string;
  lang: string; // ISO 639-1 of the source language
  baseName: string; // aqa_<lang>_<slug>_<hash>, extension added by the source
  allowOgg: boolean;
}

export interface AudioSource {
  id: string;
  find(lookup: MediaLookup): Promise<MediaResult | null>;
}
