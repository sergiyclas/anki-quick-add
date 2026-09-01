// The offline queue lives in IndexedDB, not chrome.storage.local: the latter is capped at 10 MB
// (writes start failing around 9 MB), which is about 45 cards once media is base64-encoded.

import type { MediaResult } from "../media/types";
import type { Prepared } from "../pipeline/addWord";

export interface StoredMedia extends Omit<MediaResult, "data"> {
  blob: Blob;
}

export interface QueuedItem {
  id: string;
  at: number;
  word: string;
  profile: string; // Anki profile this card was prepared for; "" when Anki was never reached
  attempts: number;
  lastError?: string;
  prepared: Omit<Prepared, "media"> & { media: StoredMedia[] };
}

const DB_NAME = "aqa-queue";
const STORE = "items";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function putItem(item: QueuedItem): Promise<void> {
  await withStore("readwrite", (store) => store.put(item));
}

export async function allItems(): Promise<QueuedItem[]> {
  const items = await withStore<QueuedItem[]>("readonly", (store) => store.getAll());
  return items.sort((a, b) => a.at - b.at);
}

export async function deleteItem(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function countItems(): Promise<number> {
  return withStore<number>("readonly", (store) => store.count());
}

export async function clearItems(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
}
