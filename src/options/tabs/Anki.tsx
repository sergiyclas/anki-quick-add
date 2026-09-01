import { useEffect, useState } from "preact/hooks";
import { t } from "../../lib/i18n";
import { send } from "../../lib/messages";
import { BUILTIN_MODEL_NAME, type DuplicatePolicy } from "../../lib/settings/schema";
import type { SettingsState } from "../../ui/useSettings";
import { FieldMappingTable } from "../components/FieldMappingTable";
import { GrantHostButton } from "../components/GrantHostButton";

function useList(type: "decks.list" | "models.list") {
  const [items, setItems] = useState<string[]>([]);
  const [error, setError] = useState("");
  async function load(refresh: boolean) {
    const r = await send({ type, refresh });
    if (r.ok) {
      setItems(r.items);
      setError("");
    } else {
      setError(r.error);
    }
  }
  useEffect(() => {
    load(false);
  }, []);
  return { items, error, refresh: () => load(true) };
}

function Select({ value, items, onChange }: { value: string; items: string[]; onChange(v: string): void }) {
  const options = items.includes(value) || !value ? items : [value, ...items];
  return (
    <select value={value} onChange={(e) => onChange(e.currentTarget.value)}>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

const POLICIES: DuplicatePolicy[] = ["skip", "add", "update"];

export function AnkiTab({ state }: { state: SettingsState }) {
  const { settings, update, mapping, modelFields, modelFieldsError, updateMapping, reloadModelFields } = state;
  const decks = useList("decks.list");
  const models = useList("models.list");
  const [createStatus, setCreateStatus] = useState("");
  const anki = settings.anki;
  const set = (patch: Partial<typeof anki>) => update((s) => ({ ...s, anki: { ...s.anki, ...patch } }));
  const modelOptions = models.items.includes(BUILTIN_MODEL_NAME) ? models.items : [BUILTIN_MODEL_NAME, ...models.items];
  const builtinMissing = anki.modelName === BUILTIN_MODEL_NAME && models.items.length > 0 && !models.items.includes(BUILTIN_MODEL_NAME);

  async function createBuiltin() {
    setCreateStatus("…");
    const r = await send({ type: "model.ensureBuiltin" });
    setCreateStatus(r.ok ? t("note_type_created") : r.error);
    if (r.ok) {
      await models.refresh();
      await reloadModelFields();
    }
  }

  return (
    <>
      <label class="field">
        <span>{t("opt_anki_url")}</span>
        <input type="url" value={anki.url} onInput={(e) => set({ url: e.currentTarget.value.trim().replace(/\/+$/, "") })} />
        <GrantHostButton url={anki.url} />
      </label>

      <label class="field">
        <span>{t("opt_deck")}</span>
        <div class="row">
          <Select value={anki.deck} items={decks.items} onChange={(deck) => set({ deck })} />
          <button type="button" class="secondary" onClick={decks.refresh}>
            {t("refresh")}
          </button>
        </div>
        {decks.error && <div class="hint err">{decks.error}</div>}
      </label>

      <label class="field">
        <span>{t("opt_note_type")}</span>
        <div class="row">
          <Select value={anki.modelName} items={modelOptions} onChange={(modelName) => set({ modelName })} />
          <button type="button" class="secondary" onClick={() => models.refresh().then(reloadModelFields)}>
            {t("refresh")}
          </button>
        </div>
        {models.error && <div class="hint err">{models.error}</div>}
        {builtinMissing && (
          <div class="row hint warn">
            <span>{t("note_type_missing")}</span>
            <button type="button" class="secondary" onClick={createBuiltin}>
              {t("create_note_type")}
            </button>
            <span>{createStatus}</span>
          </div>
        )}
        {anki.modelName === BUILTIN_MODEL_NAME && !builtinMissing && <div class="hint">{t("note_type_builtin_hint")}</div>}
      </label>

      {anki.modelName === BUILTIN_MODEL_NAME && (
        <label class="field check">
          <input type="checkbox" checked={anki.production} onChange={(e) => set({ production: e.currentTarget.checked })} />
          <span>{t("opt_production")}</span>
        </label>
      )}

      <div class="field">
        <span>{t("mapping_title")}</span>
        <div class="hint">{t("mapping_hint")}</div>
        {modelFieldsError && <div class="hint err">{modelFieldsError}</div>}
        {mapping && <FieldMappingTable mapping={mapping} fields={modelFields} settings={settings} onChange={updateMapping} />}
      </div>

      <label class="field">
        <span>{t("opt_dup_policy")}</span>
        <select value={anki.duplicatePolicy} onChange={(e) => set({ duplicatePolicy: e.currentTarget.value as DuplicatePolicy })}>
          {POLICIES.map((p) => (
            <option key={p} value={p}>
              {t(`dup_${p}`)}
            </option>
          ))}
        </select>
      </label>

      <label class="field">
        <span>{t("opt_dedupe_scope")}</span>
        <select value={anki.dedupeScope} onChange={(e) => set({ dedupeScope: e.currentTarget.value as "collection" | "deck" })}>
          <option value="collection">{t("scope_collection")}</option>
          <option value="deck">{t("scope_deck")}</option>
        </select>
      </label>

      <label class="field">
        <span>{t("opt_tags")}</span>
        <input type="text" value={anki.tags.join(", ")} onInput={(e) => set({ tags: e.currentTarget.value.split(/[,\s]+/).filter(Boolean) })} />
        <div class="hint">{t("opt_tags_hint")}</div>
      </label>

      <label class="field check">
        <input type="checkbox" checked={anki.autoLangTag} onChange={(e) => set({ autoLangTag: e.currentTarget.checked })} />
        <span>{t("opt_auto_lang_tag")}</span>
      </label>
    </>
  );
}
