import type { JsonSchema } from "../generation/types";
import type { GenerationSettings, ProviderId, ProviderSettings } from "../settings/schema";

export type ProviderErrorCode = "auth" | "http" | "refusal" | "truncated" | "empty" | "invalid_json" | "network";

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ModelInfo {
  id: string;
  label?: string;
}

export interface GenerateRequest {
  system: string;
  user: string;
  schema: JsonSchema;
  schemaName: string;
  maxTokens: number;
  signal?: AbortSignal;
  // Structured view of the same request, for adapters that do not talk to a language model.
  word: string;
  context?: string;
  senseFromContext?: boolean; // free provider: let the sentence choose the sense
  source: string;
  target: string;
  generation: GenerationSettings;
}

export interface GenerateResult {
  json: unknown;
  raw: string;
  model: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  hostPatterns(cfg: ProviderSettings): string[];
  listModels(cfg: ProviderSettings, key: string): Promise<ModelInfo[]>;
  generate(req: GenerateRequest, cfg: ProviderSettings, key: string): Promise<GenerateResult>;
}
