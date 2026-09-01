import { loadSettings } from "./settings/storage";

// UI strings normally come from chrome.i18n, which follows the browser language. When the user picks a
// language in the settings, the matching _locales/<code>/messages.json is loaded and takes precedence.
// (The name and description shown in chrome://extensions are resolved by Chrome itself and keep the
// browser language.)

export const UI_LOCALES: readonly { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "uk", name: "Українська" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "it", name: "Italiano" },
  { code: "pl", name: "Polski" },
  { code: "pt_BR", name: "Português (Brasil)" },
  { code: "nl", name: "Nederlands" },
  { code: "tr", name: "Türkçe" },
  { code: "ja", name: "日本語" },
  { code: "zh_CN", name: "简体中文" },
];

export interface MessageEntry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

type Messages = Record<string, MessageEntry>;

let override: Messages | null = null;
let overrideCode = "auto";

// Expands a messages.json entry the way chrome.i18n does: $NAME$ -> placeholders[NAME].content ($1, $2…),
// $n -> substitution n, $$ -> $.
export function formatMessage(entry: MessageEntry, substitutions?: string | string[]): string {
  const subs = substitutions === undefined ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
  const named = entry.message.replace(/\$([A-Za-z0-9_@]+)\$/g, (whole, name: string) => {
    const content = entry.placeholders?.[name]?.content ?? entry.placeholders?.[name.toLowerCase()]?.content;
    return content ?? whole;
  });
  return named.replace(/\$(\d)|\$\$/g, (whole, index?: string) => (index ? (subs[Number(index) - 1] ?? "") : whole === "$$" ? "$" : whole));
}

export async function loadUiLanguage(code: string): Promise<void> {
  if (code === overrideCode) return;
  overrideCode = code;
  if (code === "auto") {
    override = null;
    return;
  }
  try {
    const res = await fetch(chrome.runtime.getURL(`_locales/${code}/messages.json`));
    override = res.ok ? ((await res.json()) as Messages) : null;
  } catch {
    override = null;
  }
}

export async function initI18n(): Promise<void> {
  const settings = await loadSettings();
  await loadUiLanguage(settings.ui.language);
}

export function t(key: string, substitutions?: string | string[]): string {
  const entry = override?.[key];
  if (entry) return formatMessage(entry, substitutions);
  return chrome.i18n.getMessage(key, substitutions) || key;
}
