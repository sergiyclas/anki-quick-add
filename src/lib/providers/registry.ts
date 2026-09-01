import type { ProviderId } from "../settings/schema";
import { anthropic } from "./anthropic";
import { gemini } from "./gemini";
import { openai } from "./openai";
import { openaiCompat } from "./openaiCompat";
import type { ProviderAdapter } from "./types";

export const PROVIDERS: readonly { id: ProviderId; label: string }[] = [
  { id: "anthropic", label: "Anthropic (Claude)" },
  { id: "openai", label: "OpenAI (GPT)" },
  { id: "gemini", label: "Google Gemini" },
  { id: "compat", label: "OpenAI-compatible (OpenRouter, Groq, DeepSeek, xAI, Mistral, Ollama, …)" },
];

const ADAPTERS: Record<ProviderId, ProviderAdapter> = { anthropic, openai, gemini, compat: openaiCompat };

export function getAdapter(id: ProviderId): ProviderAdapter {
  return ADAPTERS[id];
}
