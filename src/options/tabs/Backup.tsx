import { useEffect, useState } from "preact/hooks";
import { t } from "../../lib/i18n";
import { applyImport, buildExport, parseExport } from "../../lib/settings/exportImport";
import { clearAll } from "../../lib/settings/storage";
import type { SettingsState } from "../../ui/useSettings";

export function BackupTab({ state }: { state: SettingsState }) {
  const { settings, keys, update } = state;
  const [includeKeys, setIncludeKeys] = useState(false);
  const [message, setMessage] = useState<{ text: string; cls: string }>({ text: "", cls: "" });
  const [origins, setOrigins] = useState<string[]>([]);

  useEffect(() => {
    chrome.permissions.getAll().then((p) => setOrigins(p.origins ?? []));
  }, []);

  async function exportSettings() {
    const file = await buildExport(settings, includeKeys ? keys : null);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `anki-quick-add-settings-${file.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importSettings(input: HTMLInputElement) {
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    try {
      const file = parseExport(await f.text());
      const summary = t("backup_import_confirm", [String(file.mappings.length), file.keys ? t("yes") : t("no")]);
      if (!window.confirm(summary)) return;
      await applyImport(file);
      window.location.reload();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), cls: "err" });
    }
  }

  async function reset() {
    if (!window.confirm(t("backup_reset_confirm"))) return;
    await clearAll();
    window.location.reload();
  }

  return (
    <>
      <div class="field">
        <span>{t("backup_export")}</span>
        <div class="row">
          <button type="button" onClick={exportSettings}>
            {t("backup_export_button")}
          </button>
          <label class="check">
            <input type="checkbox" checked={includeKeys} onChange={(e) => setIncludeKeys(e.currentTarget.checked)} />
            <span>{t("backup_include_keys")}</span>
          </label>
        </div>
      </div>

      <div class="field">
        <span>{t("backup_import")}</span>
        <input type="file" accept="application/json,.json" onChange={(e) => importSettings(e.currentTarget)} />
        <div class="hint">{t("backup_import_hint")}</div>
      </div>

      <label class="field check">
        <input
          type="checkbox"
          checked={settings.ui.syncKeys}
          onChange={(e) => update((s) => ({ ...s, ui: { ...s.ui, syncKeys: e.currentTarget.checked } }))}
        />
        <span>{t("backup_sync_keys")}</span>
      </label>
      <div class="hint">{t("backup_sync_keys_hint")}</div>

      <div class="field">
        <span>{t("backup_diagnostics")}</span>
        <div class="hint">
          {t("backup_version")}: {chrome.runtime.getManifest().version} · {t("backup_granted_origins")}: {origins.length ? origins.join(", ") : "–"}
        </div>
      </div>

      <div class="field">
        <button type="button" class="secondary danger" onClick={reset}>
          {t("backup_reset")}
        </button>
      </div>

      {message.text && <div class={`hint ${message.cls}`}>{message.text}</div>}
    </>
  );
}
