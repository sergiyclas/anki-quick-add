export const SCHEMA_VERSION = 2;

export type ProviderId = "anthropic" | "openai" | "gemini" | "compat";
export type CompatPreset = "openrouter" | "groq" | "deepseek" | "xai" | "mistral" | "ollama" | "lmstudio" | "custom";
export type Effort = "low" | "medium" | "high";
export type JsonMode = "auto" | "json_schema" | "json_object";
export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type AudioSourceId = "dictionary" | "wiktionary" | "tts";
export type DuplicatePolicy = "skip" | "add" | "update";
export type BubbleTrigger = "always" | "shift" | "alt";

export interface ProviderSettings {
  model: string;
  effort: Effort;
  baseUrl?: string;
  preset?: CompatPreset;
  jsonMode?: JsonMode;
}

export interface GenerationSettings {
  level: Cefr;
  translationsCount: number;
  synonymsCount: number;
  examplesCount: number;
  transcription: boolean;
  partOfSpeech: boolean;
  definition: boolean;
  synonyms: boolean;
  grammar: boolean;
  exampleTranslations: boolean;
  extraInstructions: string;
}

export interface Settings {
  version: typeof SCHEMA_VERSION;
  provider: ProviderId;
  providers: Record<ProviderId, ProviderSettings>;
  languages: { source: string; target: string };
  generation: GenerationSettings;
  media: {
    audio: { enabled: boolean; order: AudioSourceId[]; allowOgg: boolean };
    image: { enabled: boolean; maxWidth: number; storeCredit: boolean };
  };
  anki: {
    url: string;
    deck: string;
    modelName: string;
    tags: string[];
    autoLangTag: boolean;
    duplicatePolicy: DuplicatePolicy;
    dedupeScope: "collection" | "deck";
    production: boolean;
  };
  ui: {
    syncKeys: boolean;
    contextMenuDeckLimit: number;
    batchConcurrency: 1 | 2;
    historySize: number;
    quickTranslate: boolean; // instant Google translation in the popup while typing
    selectionBubble: boolean; // bubble on text selection in web pages (needs access to all sites)
    bubbleTrigger: BubbleTrigger; // show on every selection, or only while Shift/Alt is held
  };
}

export interface ApiKeys {
  anthropic?: string;
  openai?: string;
  gemini?: string;
  compat?: Record<string, string>; // keyed by base URL host
}

export const BUILTIN_MODEL_NAME = "Anki Quick Add";
export const DEFAULT_ANKI_URL = "http://127.0.0.1:8765";

export const DEFAULT_SETTINGS: Settings = {
  version: SCHEMA_VERSION,
  provider: "anthropic",
  providers: {
    anthropic: { model: "claude-sonnet-5", effort: "low" },
    openai: { model: "gpt-5.6-terra", effort: "low" },
    gemini: { model: "gemini-3.5-flash", effort: "low" },
    compat: { model: "", effort: "low", baseUrl: "", preset: "openrouter", jsonMode: "auto" },
  },
  languages: { source: "en", target: "uk" },
  generation: {
    level: "B1",
    translationsCount: 3,
    synonymsCount: 6,
    examplesCount: 3,
    transcription: true,
    partOfSpeech: true,
    definition: false,
    synonyms: true,
    grammar: true,
    exampleTranslations: false,
    extraInstructions: "",
  },
  media: {
    audio: { enabled: true, order: ["dictionary", "wiktionary", "tts"], allowOgg: false },
    image: { enabled: true, maxWidth: 480, storeCredit: true },
  },
  anki: {
    url: DEFAULT_ANKI_URL,
    deck: "Default",
    modelName: BUILTIN_MODEL_NAME,
    tags: ["quick-add"],
    autoLangTag: true,
    duplicatePolicy: "skip",
    dedupeScope: "collection",
    production: false,
  },
  ui: { syncKeys: true, contextMenuDeckLimit: 8, batchConcurrency: 1, historySize: 20, quickTranslate: true, selectionBubble: false, bubbleTrigger: "shift" },
};

// Fills in any section/key missing from a stored (possibly older or partial) settings object.
export function withDefaults(partial: Partial<Settings> | undefined): Settings {
  const p = partial ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...p,
    version: SCHEMA_VERSION,
    providers: {
      anthropic: { ...DEFAULT_SETTINGS.providers.anthropic, ...p.providers?.anthropic },
      openai: { ...DEFAULT_SETTINGS.providers.openai, ...p.providers?.openai },
      gemini: { ...DEFAULT_SETTINGS.providers.gemini, ...p.providers?.gemini },
      compat: { ...DEFAULT_SETTINGS.providers.compat, ...p.providers?.compat },
    },
    languages: { ...DEFAULT_SETTINGS.languages, ...p.languages },
    generation: { ...DEFAULT_SETTINGS.generation, ...p.generation },
    media: {
      audio: { ...DEFAULT_SETTINGS.media.audio, ...p.media?.audio },
      image: { ...DEFAULT_SETTINGS.media.image, ...p.media?.image },
    },
    anki: { ...DEFAULT_SETTINGS.anki, ...p.anki },
    ui: { ...DEFAULT_SETTINGS.ui, ...p.ui },
  };
}
