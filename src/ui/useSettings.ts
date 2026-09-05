import { useCallback, useEffect, useState } from "preact/hooks";
import { send } from "../lib/messages";
import { type FieldMapping, guessMapping, resolveDefaultMapping } from "../lib/note/mapping";
import type { ApiKeys, Settings } from "../lib/settings/schema";
import { loadKeys, loadMapping, loadSettings, saveKeys, saveMapping, saveSettings } from "../lib/settings/storage";

export interface SettingsState {
  settings: Settings;
  keys: ApiKeys;
  mapping: FieldMapping | null;
  modelFields: string[];
  modelFieldsError: string;
  dirty: boolean;
  update(patch: (s: Settings) => Settings): void;
  applyNow(patch: (s: Settings) => Settings): Promise<void>; // persist one change at once, without marking the form dirty
  updateKeys(patch: (k: ApiKeys) => ApiKeys): void;
  updateMapping(patch: (m: FieldMapping) => FieldMapping): void;
  reloadModelFields(): Promise<void>;
  save(): Promise<void>;
}

export function useSettings(): SettingsState | null {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [keys, setKeys] = useState<ApiKeys>({});
  const [mapping, setMapping] = useState<FieldMapping | null>(null);
  const [modelFields, setModelFields] = useState<string[]>([]);
  const [modelFieldsError, setModelFieldsError] = useState("");
  const [dirty, setDirty] = useState(false);
  const modelName = settings?.anki.modelName;

  useEffect(() => {
    Promise.all([loadSettings(), loadKeys()]).then(([s, k]) => {
      setSettings(s);
      setKeys(k);
    });
  }, []);

  const loadFieldsAndMapping = useCallback(
    async (refresh: boolean) => {
      if (!modelName) return;
      const r = await send({ type: "model.fields", modelName, refresh });
      const fields = r.ok ? r.items : [];
      setModelFields(fields);
      setModelFieldsError(r.ok ? "" : r.error);
      const stored = await loadMapping(modelName);
      setMapping(stored ?? resolveDefaultMapping(modelName, fields) ?? guessMapping(modelName, fields));
    },
    [modelName],
  );

  useEffect(() => {
    loadFieldsAndMapping(false);
  }, [loadFieldsAndMapping]);

  const update = useCallback((patch: (s: Settings) => Settings) => {
    setSettings((s) => (s ? patch(s) : s));
    setDirty(true);
  }, []);

  // Writes the patch on top of what is stored right now, not on top of this page's snapshot: another
  // options tab may have saved something since this one was opened, and it must not be rolled back.
  const applyNow = useCallback(async (patch: (s: Settings) => Settings) => {
    const stored = await loadSettings();
    setSettings((current) => (current ? patch(current) : patch(stored)));
    await saveSettings(patch(stored));
  }, []);

  const updateKeys = useCallback((patch: (k: ApiKeys) => ApiKeys) => {
    setKeys((k) => patch(k));
    setDirty(true);
  }, []);

  const updateMapping = useCallback((patch: (m: FieldMapping) => FieldMapping) => {
    setMapping((m) => (m ? patch(m) : m));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!settings) return;
    await saveSettings(settings);
    await saveKeys(keys, settings.ui.syncKeys);
    if (mapping && mapping.modelName === settings.anki.modelName) await saveMapping(mapping);
    setDirty(false);
  }, [settings, keys, mapping]);

  if (!settings) return null;
  return {
    settings,
    keys,
    mapping,
    modelFields,
    modelFieldsError,
    dirty,
    update,
    applyNow,
    updateKeys,
    updateMapping,
    reloadModelFields: () => loadFieldsAndMapping(true),
    save,
  };
}
