import type { AddResult } from "./pipeline/addWord";

export interface HistoryEntry {
  word: string;
  translation: string;
  status: "added" | "updated";
  noteId: number;
  deck: string;
  at: number;
}

const KEY = "history";

export async function loadHistory(): Promise<HistoryEntry[]> {
  const stored = await chrome.storage.local.get(KEY);
  return (stored[KEY] as HistoryEntry[] | undefined) ?? [];
}

export async function pushHistory(result: AddResult, deck: string, limit: number): Promise<void> {
  if (result.status !== "added" && result.status !== "updated") return;
  const entry: HistoryEntry = { word: result.word, translation: result.summary.translation, status: result.status, noteId: result.noteId, deck, at: Date.now() };
  const history = (await loadHistory()).filter((h) => h.noteId !== entry.noteId);
  await chrome.storage.local.set({ [KEY]: [entry, ...history].slice(0, limit) });
}
