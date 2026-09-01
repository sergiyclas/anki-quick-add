import { maxBatchConcurrency } from "../license";
import { loadSettings } from "../settings/storage";
import { type AddResult, addWord } from "./addWord";

export type BatchItemStatus = "pending" | "running" | "added" | "updated" | "duplicate" | "error" | "cancelled";

export interface BatchItem {
  word: string;
  status: BatchItemStatus;
  detail?: string; // translation or error message
}

export interface BatchState {
  id: string;
  deck?: string;
  items: BatchItem[];
  running: boolean;
  cancelled: boolean;
  startedAt: number;
}

const KEY = "batch:current";

export function splitWords(input: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const raw of input.split(/[\n,;]+/)) {
    const word = raw.trim();
    const k = word.toLowerCase();
    if (!word || seen.has(k)) continue;
    seen.add(k);
    words.push(word);
  }
  return words;
}

export async function getBatch(): Promise<BatchState | undefined> {
  const stored = await chrome.storage.session.get(KEY);
  return stored[KEY] as BatchState | undefined;
}

// Writing after every item keeps the service worker alive and lets the popup be closed and reopened.
async function save(state: BatchState): Promise<void> {
  await chrome.storage.session.set({ [KEY]: state });
}

function describe(result: AddResult): Pick<BatchItem, "status" | "detail"> {
  switch (result.status) {
    case "added":
    case "updated":
      return { status: result.status, detail: result.summary.translation };
    case "duplicate":
      return { status: "duplicate" };
    case "error":
      return { status: "error", detail: result.message };
  }
}

// Concurrency comes from the settings, capped by the licence tier (1 free, 2 pro, 3 founder).
export async function effectiveConcurrency(): Promise<number> {
  const settings = await loadSettings();
  return Math.max(1, Math.min(settings.ui.batchConcurrency, maxBatchConcurrency(settings.license.tier)));
}

// Read-modify-write of one item; the state in session storage is the source of truth while running.
async function updateItem(id: string, index: number, patch: Partial<BatchItem>): Promise<BatchState | undefined> {
  const current = await getBatch();
  if (!current || current.id !== id) return undefined;
  current.items[index] = { ...current.items[index]!, ...patch };
  await save(current);
  return current;
}

async function run(state: BatchState): Promise<void> {
  const concurrency = await effectiveConcurrency();
  let next = 0;

  const worker = async () => {
    for (;;) {
      const current = await getBatch();
      if (!current || current.id !== state.id) return;
      if (current.cancelled) return;
      const index = next++;
      if (index >= current.items.length) return;
      if (current.items[index]!.status !== "pending") continue;
      await updateItem(state.id, index, { status: "running" });
      const result = await addWord({ word: current.items[index]!.word, deck: current.deck });
      await updateItem(state.id, index, describe(result));
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  const done = await getBatch();
  if (!done || done.id !== state.id) return;
  if (done.cancelled) done.items = done.items.map((it) => (it.status === "pending" || it.status === "running" ? { ...it, status: "cancelled" } : it));
  await save({ ...done, running: false });
}

// Starts a new batch (replacing a finished one) or resumes the pending items of the stored batch.
export async function startBatch(words: string[], deck?: string): Promise<BatchState> {
  const existing = await getBatch();
  if (existing?.running) return existing;
  const state: BatchState = {
    id: crypto.randomUUID(),
    deck,
    items: words.map((word) => ({ word, status: "pending" })),
    running: true,
    cancelled: false,
    startedAt: Date.now(),
  };
  await save(state);
  void run(state);
  return state;
}

export async function resumeBatch(): Promise<BatchState | undefined> {
  const existing = await getBatch();
  if (!existing || existing.running) return existing;
  const state: BatchState = {
    ...existing,
    id: crypto.randomUUID(),
    items: existing.items.map((it) => (it.status === "cancelled" || it.status === "error" ? { word: it.word, status: "pending" } : it)),
    running: true,
    cancelled: false,
  };
  await save(state);
  void run(state);
  return state;
}

export async function cancelBatch(): Promise<void> {
  const existing = await getBatch();
  if (existing?.running) await save({ ...existing, cancelled: true });
}

export async function clearBatch(): Promise<void> {
  await chrome.storage.session.remove(KEY);
}
