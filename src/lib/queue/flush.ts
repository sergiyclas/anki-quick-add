import { AnkiClient } from "../anki/client";
import { type Prepared, commit } from "../pipeline/addWord";
import { loadSettings, setCache } from "../settings/storage";
import { type QueuedItem, allItems, countItems, deleteItem, putItem } from "./db";
import { base64FromBlob } from "./media";
import { refreshBadge } from "./store";

const PER_FLUSH = 25; // one run stays short so the service worker is not killed halfway through

export interface FlushSummary {
  reachable: boolean;
  profile?: string;
  added: number;
  duplicates: number;
  errors: number;
  held: number; // cards belonging to an Anki profile other than the one currently open
  remaining: number;
}

async function rehydrate(item: QueuedItem): Promise<Prepared> {
  const media = await Promise.all(item.prepared.media.map(async ({ blob, ...m }) => ({ ...m, data: await base64FromBlob(blob) })));
  return { ...item.prepared, media };
}

// Writes what it can and leaves the rest for the next run: a card is removed only once Anki has taken it.
export async function flushQueue(): Promise<FlushSummary> {
  const summary: FlushSummary = { reachable: false, added: 0, duplicates: 0, errors: 0, held: 0, remaining: 0 };
  const items = await allItems().catch(() => []);
  summary.remaining = items.length;
  if (!items.length) {
    summary.reachable = true;
    return summary;
  }

  const settings = await loadSettings();
  const client = new AnkiClient(settings.anki.url);
  try {
    await client.version();
  } catch {
    return summary; // still closed
  }
  summary.reachable = true;
  const profile = await client.activeProfile().catch(() => "");
  if (profile) {
    summary.profile = profile;
    await setCache("profile", profile);
  }

  for (const item of items.slice(0, PER_FLUSH)) {
    if (item.profile && profile && item.profile !== profile) {
      summary.held++;
      continue;
    }
    const result = await commit(await rehydrate(item));
    if (result.status === "error") {
      if (result.step === "anki") break; // Anki went away again - keep everything and retry later
      summary.errors++;
      await putItem({ ...item, attempts: item.attempts + 1, lastError: result.message });
      continue;
    }
    if (result.status === "duplicate") summary.duplicates++;
    else summary.added++;
    await deleteItem(item.id);
  }

  summary.remaining = await countItems();
  await refreshBadge();
  return summary;
}
