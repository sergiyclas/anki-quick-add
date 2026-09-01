import type { FieldMapping } from "../note/mapping";
import { type ApiKeys, type Settings, withDefaults } from "./schema";

// Storage layout:
//   sync : settings, mapping:<modelName>, keys (unless ui.syncKeys is off)
//   local: keys (when not synced), cache.*, history
//   session: job:<id>, batch:<id>

const SETTINGS_KEY = "settings";
const KEYS_KEY = "keys";

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return withDefaults(stored[SETTINGS_KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

export async function loadKeys(): Promise<ApiKeys> {
  const [local, sync] = await Promise.all([chrome.storage.local.get(KEYS_KEY), chrome.storage.sync.get(KEYS_KEY)]);
  return (local[KEYS_KEY] as ApiKeys | undefined) ?? (sync[KEYS_KEY] as ApiKeys | undefined) ?? {};
}

export async function saveKeys(keys: ApiKeys, syncKeys: boolean): Promise<void> {
  const target = syncKeys ? chrome.storage.sync : chrome.storage.local;
  const other = syncKeys ? chrome.storage.local : chrome.storage.sync;
  await target.set({ [KEYS_KEY]: keys });
  await other.remove(KEYS_KEY);
}

export function mappingKey(modelName: string): string {
  return `mapping:${modelName}`;
}

export async function loadMapping(modelName: string): Promise<FieldMapping | undefined> {
  const stored = await chrome.storage.sync.get(mappingKey(modelName));
  return stored[mappingKey(modelName)] as FieldMapping | undefined;
}

export async function saveMapping(mapping: FieldMapping): Promise<void> {
  await chrome.storage.sync.set({ [mappingKey(mapping.modelName)]: mapping });
}

export async function listMappings(): Promise<FieldMapping[]> {
  const all = await chrome.storage.sync.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith("mapping:"))
    .map(([, value]) => value as FieldMapping);
}

export async function clearAll(): Promise<void> {
  await Promise.all([chrome.storage.sync.clear(), chrome.storage.local.clear()]);
}

export interface CacheEntry<T> {
  items: T;
  at: number;
}

export async function getCache<T>(name: string): Promise<CacheEntry<T> | undefined> {
  const key = `cache.${name}`;
  const stored = await chrome.storage.local.get(key);
  return stored[key] as CacheEntry<T> | undefined;
}

export async function setCache<T>(name: string, items: T): Promise<void> {
  await chrome.storage.local.set({ [`cache.${name}`]: { items, at: Date.now() } satisfies CacheEntry<T> });
}
