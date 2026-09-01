import type { FieldMapping } from "../note/mapping";
import { type ApiKeys, SCHEMA_VERSION, type Settings, withDefaults } from "./schema";
import { listMappings, saveKeys, saveMapping, saveSettings } from "./storage";

export interface ExportFile {
  app: "anki-quick-add";
  version: typeof SCHEMA_VERSION;
  exportedAt: string;
  settings: Settings;
  mappings: FieldMapping[];
  keys?: ApiKeys;
}

export async function buildExport(settings: Settings, keys: ApiKeys | null): Promise<ExportFile> {
  const file: ExportFile = {
    app: "anki-quick-add",
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    mappings: await listMappings(),
  };
  if (keys) file.keys = keys;
  return file;
}

export function parseExport(text: string): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Not a JSON file");
  }
  const file = data as Partial<ExportFile>;
  if (file.app !== "anki-quick-add" || typeof file.settings !== "object" || file.settings === null) {
    throw new Error("Not an Anki Quick Add settings file");
  }
  if (file.version !== SCHEMA_VERSION) throw new Error(`Unsupported settings version ${String(file.version)}`);
  return {
    app: "anki-quick-add",
    version: SCHEMA_VERSION,
    exportedAt: file.exportedAt ?? "",
    settings: withDefaults(file.settings),
    mappings: Array.isArray(file.mappings) ? file.mappings : [],
    ...(file.keys ? { keys: file.keys } : {}),
  };
}

export async function applyImport(file: ExportFile): Promise<void> {
  await saveSettings(file.settings);
  for (const mapping of file.mappings) await saveMapping(mapping);
  if (file.keys) await saveKeys(file.keys, file.settings.ui.syncKeys);
}
