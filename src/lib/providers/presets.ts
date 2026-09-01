import type { CompatPreset } from "../settings/schema";

export interface CompatPresetDef {
  id: CompatPreset;
  label: string;
  baseUrl: string;
  jsonMode: "json_schema" | "json_object";
  keyOptional?: boolean;
}

export const COMPAT_PRESETS: readonly CompatPresetDef[] = [
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", jsonMode: "json_schema" },
  { id: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", jsonMode: "json_object" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com", jsonMode: "json_object" },
  { id: "xai", label: "xAI (Grok)", baseUrl: "https://api.x.ai/v1", jsonMode: "json_schema" },
  { id: "mistral", label: "Mistral", baseUrl: "https://api.mistral.ai/v1", jsonMode: "json_schema" },
  { id: "ollama", label: "Ollama (local)", baseUrl: "http://localhost:11434/v1", jsonMode: "json_schema", keyOptional: true },
  { id: "lmstudio", label: "LM Studio (local)", baseUrl: "http://localhost:1234/v1", jsonMode: "json_schema", keyOptional: true },
  { id: "custom", label: "Custom", baseUrl: "", jsonMode: "json_schema" },
];
