import { ensureBuiltinModel } from "../lib/anki/builtinModel";
import { AnkiClient } from "../lib/anki/client";
import type { ErrorResponse, ListResponse, PingResponse, Request, ResponseFor } from "../lib/messages";
import { addWord } from "../lib/pipeline/addWord";
import { cancelBatch, clearBatch, getBatch, resumeBatch, startBatch } from "../lib/pipeline/batch";
import { KEYLESS, getAdapter } from "../lib/providers/registry";
import { applyTheme } from "../lib/anki/builtinModel";
import { getCache, loadKeys, loadSettings, setCache } from "../lib/settings/storage";
import { initI18n, t } from "../lib/i18n";
import { quickTranslate } from "../lib/quickTranslate";
import { flushQueue } from "../lib/queue/flush";
import { clearQueue, queueCount, queueStatus } from "../lib/queue/store";
import { extractSentence } from "../lib/text";
import { bubbleStatus, syncBubbleScript } from "./bubble";
import { commitJob, openEditor, regenerateJob } from "./jobs";

async function cachedList(name: string, refresh: boolean | undefined, fetch: () => Promise<string[]>): Promise<ListResponse> {
  if (!refresh) {
    const cached = await getCache<string[]>(name);
    if (cached) return { ok: true, items: cached.items };
  }
  const items = await fetch();
  await setCache(name, items);
  return { ok: true, items };
}

async function ping(): Promise<PingResponse> {
  const [settings, keys] = await Promise.all([loadSettings(), loadKeys()]);
  const client = new AnkiClient(settings.anki.url, 3_000);
  const anki = await client.version().then(
    (version) => ({ ok: true, version }),
    (e: Error) => ({ ok: false, error: e.message }),
  );
  // Remember which collection is open, so queued cards are never written into a different profile.
  if (anki.ok) {
    void client.activeProfile().then(
      async (profile) => {
        if (profile) await setCache("profile", profile);
      },
      () => undefined,
    );
  }
  const hasKey = KEYLESS.has(settings.provider) ? true : Boolean(keys[settings.provider as Exclude<typeof settings.provider, "free" | "compat">]);
  return {
    ok: true,
    version: chrome.runtime.getManifest().version,
    anki,
    hasKey,
    provider: settings.provider,
    model: settings.providers[settings.provider].model,
    deck: settings.anki.deck,
    quickTranslate: settings.ui.quickTranslate,
    queued: await queueCount(),
  };
}

export async function handleMessage<R extends Request>(request: R): Promise<ResponseFor<R> | ErrorResponse> {
  const response = await dispatch(request);
  return response as ResponseFor<R>;
}

// The bubble sends the surrounding paragraph; the sentence is extracted here so the content script stays dependency-free.
function contextOf(r: { word: string; context?: string; block?: string }): string | undefined {
  return r.context ?? (r.block ? extractSentence(r.block, r.word) || undefined : undefined);
}

async function dispatch(request: Request) {
  switch (request.type) {
    case "ping":
      return ping();
    case "add":
      return { ok: true, result: await addWord({ ...request, context: contextOf(request) }) };
    case "editor.open":
      return { ok: true, id: (await openEditor({ word: request.word, deck: request.deck, context: contextOf(request) })).id };
    case "i18n.strings": {
      await initI18n();
      // Placeholders stay as $1/$2 so the content script can fill them in.
      return { ok: true, strings: Object.fromEntries(request.keys.map((k) => [k, t(k, ["$1", "$2"])])) };
    }
    case "queue.status":
      return { ok: true, status: await queueStatus() };
    case "queue.flush":
      return { ok: true, summary: await flushQueue() };
    case "queue.clear":
      await clearQueue();
      return { ok: true };
    case "bubble.status":
      return { ok: true, ...(await bubbleStatus()) };
    case "bubble.sync": {
      const injected = await syncBubbleScript();
      return { ok: true, ...(await bubbleStatus()), injected };
    }
    case "translate.quick": {
      const { source, target } = (await loadSettings()).languages;
      return { ok: true, translation: await quickTranslate(request.text, source, target), source, target };
    }
    case "job.regenerate":
      await regenerateJob(request.id, request.hint);
      return { ok: true };
    case "job.commit":
      return { ok: true, result: await commitJob(request.id, request.overrides) };
    case "batch.start":
      return { ok: true, batch: await startBatch(request.words, request.deck) };
    case "batch.status":
      return { ok: true, batch: await getBatch() };
    case "batch.resume":
      return { ok: true, batch: await resumeBatch() };
    case "batch.cancel":
      await cancelBatch();
      return { ok: true };
    case "batch.clear":
      await clearBatch();
      return { ok: true };
    case "decks.list": {
      const settings = await loadSettings();
      return cachedList("decks", request.refresh, () => new AnkiClient(settings.anki.url).deckNames());
    }
    case "models.list": {
      const settings = await loadSettings();
      return cachedList("models", request.refresh, () => new AnkiClient(settings.anki.url).modelNames());
    }
    case "model.fields": {
      const settings = await loadSettings();
      return cachedList(`modelFields:${request.modelName}`, request.refresh, () =>
        new AnkiClient(settings.anki.url).modelFieldNames(request.modelName),
      );
    }
    case "model.templates": {
      const settings = await loadSettings();
      const client = new AnkiClient(settings.anki.url);
      const [templates, css] = await Promise.all([client.modelTemplates(request.modelName), client.modelStyling(request.modelName)]);
      return { ok: true, templates, css };
    }
    case "model.applyTheme": {
      const settings = await loadSettings();
      await applyTheme(new AnkiClient(settings.anki.url), request.theme);
      return { ok: true };
    }
    case "model.ensureBuiltin": {
      const settings = await loadSettings();
      const created = await ensureBuiltinModel(new AnkiClient(settings.anki.url));
      if (created) await chrome.storage.local.remove("cache.models");
      return { ok: true, created };
    }
    case "provider.listModels": {
      const models = await getAdapter(request.provider).listModels(request.cfg, request.key);
      await setCache(`providerModels:${request.provider}`, models);
      return { ok: true, models };
    }
  }
}
