// Cards added while Anki is closed are generated in full and parked here. Kept free of any import of
// the pipeline's runtime code (only its types) so that addWord can enqueue without an import cycle.

import type { Prepared } from "../pipeline/addWord";
import { getCache } from "../settings/storage";
import { allItems, clearItems, countItems, putItem } from "./db";
import { blobFromBase64 } from "./media";

export const QUEUE_LIMIT = 300; // ~45 MB of media; the browser quota itself follows free disk space

export type EnqueueResult = { queued: true; count: number } | { queued: false; reason: "full" | "duplicate"; count: number };

export interface QueueStatus {
  count: number;
  words: string[];
  profiles: string[];
  lastError?: string;
}

export async function queueCount(): Promise<number> {
  try {
    return await countItems();
  } catch {
    return 0; // IndexedDB unavailable (private mode, disk full): behave as if nothing is queued
  }
}

export async function queueStatus(): Promise<QueueStatus> {
  const items = await allItems();
  return {
    count: items.length,
    words: items.map((i) => i.word),
    profiles: [...new Set(items.map((i) => i.profile).filter(Boolean))],
    lastError: items.find((i) => i.lastError)?.lastError,
  };
}

export async function clearQueue(): Promise<void> {
  await clearItems();
}

// The profile Anki had open the last time it answered; a queued card is only written back into it.
export async function lastKnownProfile(): Promise<string> {
  return (await getCache<string>("profile"))?.items ?? "";
}

export async function enqueue(prepared: Prepared, profile: string): Promise<EnqueueResult> {
  const items = await allItems();
  if (items.length >= QUEUE_LIMIT) return { queued: false, reason: "full", count: items.length };
  if (items.some((i) => i.word === prepared.word && i.prepared.modelName === prepared.modelName)) {
    return { queued: false, reason: "duplicate", count: items.length };
  }
  const { media, ...rest } = prepared;
  await putItem({
    id: crypto.randomUUID(),
    at: Date.now(),
    word: prepared.word,
    profile,
    attempts: 0,
    prepared: { ...rest, media: media.map(({ data, ...m }) => ({ ...m, blob: blobFromBase64(data, m.mime) })) },
  });
  return { queued: true, count: items.length + 1 };
}
