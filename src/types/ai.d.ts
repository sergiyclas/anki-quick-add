// Chrome's built-in Translator API (stable since Chrome 138). Neither lib.dom nor @types/chrome
// declares it yet. Only the parts this extension uses are typed here.
// https://developer.chrome.com/docs/ai/translator-api

type AIAvailability = "unavailable" | "downloadable" | "downloading" | "available";

interface AIDownloadMonitor extends EventTarget {
  addEventListener(type: "downloadprogress", listener: (event: { loaded: number }) => void): void;
}

interface TranslatorCreateOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?: (monitor: AIDownloadMonitor) => void;
  signal?: AbortSignal;
}

declare class Translator {
  static availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<AIAvailability>;
  static create(options: TranslatorCreateOptions): Promise<Translator>;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  translate(text: string): Promise<string>;
  destroy(): void;
}
