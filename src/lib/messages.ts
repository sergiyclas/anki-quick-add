// Message protocol between extension pages (popup/options/editor) and the service worker.
// Every request is answered with a Response of the matching type; failures come back as { ok: false, error }.
import type { ModelTemplates } from "./anki/types";
import type { AddResult, CommitOverrides } from "./pipeline/addWord";
import type { BatchState } from "./pipeline/batch";
import type { FlushSummary } from "./queue/flush";
import type { QueueStatus } from "./queue/store";
import type { ModelInfo } from "./providers/types";
import type { CardTheme, ProviderId, ProviderSettings } from "./settings/schema";

export type Request =
  | { type: "ping" }
  | { type: "add"; word: string; deck?: string; tags?: string[]; context?: string; block?: string }
  | { type: "editor.open"; word: string; deck?: string; context?: string; block?: string }
  | { type: "translate.quick"; text: string }
  | { type: "bubble.status" }
  | { type: "queue.status" }
  | { type: "queue.flush" }
  | { type: "queue.clear" }
  | { type: "queue.remove"; id: string }
  | { type: "i18n.strings"; keys: string[] }
  | { type: "bubble.sync" }
  | { type: "job.regenerate"; id: string; hint: string }
  | { type: "job.commit"; id: string; overrides: CommitOverrides }
  | { type: "batch.start"; words: string[]; deck?: string }
  | { type: "batch.status" }
  | { type: "batch.resume" }
  | { type: "batch.cancel" }
  | { type: "batch.clear" }
  | { type: "decks.list"; refresh?: boolean }
  | { type: "models.list"; refresh?: boolean }
  | { type: "model.fields"; modelName: string; refresh?: boolean }
  | { type: "model.templates"; modelName: string }
  | { type: "model.ensureBuiltin" }
  | { type: "model.applyTheme"; theme: CardTheme }
  | { type: "provider.listModels"; provider: ProviderId; cfg: ProviderSettings; key: string };

export interface PingResponse {
  ok: true;
  version: string;
  anki: { ok: boolean; version?: number; error?: string };
  hasKey: boolean;
  provider: ProviderId;
  model: string;
  deck: string;
  quickTranslate: boolean;
  queued: number;
}

export interface QueueStatusResponse {
  ok: true;
  status: QueueStatus;
}

export interface QueueFlushResponse {
  ok: true;
  summary: FlushSummary;
}

export interface AddResponse {
  ok: true;
  result: AddResult;
}

export interface JobResponse {
  ok: true;
  id: string;
}

export interface OkResponse {
  ok: true;
}

export interface BatchResponse {
  ok: true;
  batch?: BatchState;
}

export interface BubbleStatusResponse {
  ok: true;
  enabled: boolean;
  permission: boolean;
  registered: boolean;
  injected?: number;
}

export interface StringsResponse {
  ok: true;
  strings: Record<string, string>;
}

export interface TranslateResponse {
  ok: true;
  translation: string;
  source: string;
  target: string;
}

export interface ListResponse {
  ok: true;
  items: string[];
}

export interface TemplatesResponse {
  ok: true;
  templates: ModelTemplates;
  css: string;
}

export interface EnsureBuiltinResponse {
  ok: true;
  created: boolean;
}

export interface ModelListResponse {
  ok: true;
  models: ModelInfo[];
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export type ResponseFor<R extends Request> = R extends { type: "ping" }
  ? PingResponse
  : R extends { type: "add" | "job.commit" }
    ? AddResponse
    : R extends { type: "editor.open" }
      ? JobResponse
      : R extends { type: "job.regenerate" | "batch.cancel" | "batch.clear" | "model.applyTheme" | "queue.clear" | "queue.remove" }
        ? OkResponse
        : R extends { type: "queue.status" }
          ? QueueStatusResponse
          : R extends { type: "queue.flush" }
            ? QueueFlushResponse
            : R extends { type: "i18n.strings" }
          ? StringsResponse
          : R extends { type: "bubble.status" | "bubble.sync" }
          ? BubbleStatusResponse
          : R extends { type: "translate.quick" }
          ? TranslateResponse
          : R extends { type: "batch.start" | "batch.status" | "batch.resume" }
          ? BatchResponse
          : R extends { type: "decks.list" | "models.list" | "model.fields" }
            ? ListResponse
            : R extends { type: "model.templates" }
              ? TemplatesResponse
              : R extends { type: "model.ensureBuiltin" }
                ? EnsureBuiltinResponse
                : R extends { type: "provider.listModels" }
                  ? ModelListResponse
                  : never;

export function send<R extends Request>(request: R): Promise<ResponseFor<R> | ErrorResponse> {
  return chrome.runtime.sendMessage(request);
}
