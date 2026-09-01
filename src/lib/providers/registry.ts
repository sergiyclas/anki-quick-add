import type { ProviderId } from "../settings/schema";
import { anthropic } from "./anthropic";
import { free } from "./free";
import { gemini } from "./gemini";
import { openai } from "./openai";
import { openaiCompat } from "./openaiCompat";
import type { ProviderAdapter } from "./types";

export const PROVIDERS: readonly { id: ProviderId; label: string }[] = [
  { id: "free", label: "Free – no API key (Google Translate + dictionaries)" },
  { id: "anthropic", label: "Anthropic (Claude)" },
  { id: "openai", label: "OpenAI (GPT)" },
  { id: "gemini", label: "Google Gemini" },
  { id: "compat", label: "OpenAI-compatible (OpenRouter, Groq, DeepSeek, xAI, Mistral, Ollama, …)" },
];

const ADAPTERS: Record<ProviderId, ProviderAdapter> = { free, anthropic, openai, gemini, compat: openaiCompat };

// Providers that work without an API key.
export const KEYLESS: ReadonlySet<ProviderId> = new Set(["free", "compat"]);

export function getAdapter(id: ProviderId): ProviderAdapter {
  return ADAPTERS[id];
}
