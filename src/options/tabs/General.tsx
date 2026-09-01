import { useEffect, useState } from "preact/hooks";
import { send } from "../../lib/messages";
import { UI_LOCALES, t } from "../../lib/i18n";
import { maxBatchConcurrency, redeemCode } from "../../lib/license";
import { QUEUE_LIMIT, type QueueStatus } from "../../lib/queue/store";
import { applyImport, buildExport, parseExport } from "../../lib/settings/exportImport";
import type { Settings } from "../../lib/settings/schema";
import { clearAll, saveSettings } from "../../lib/settings/storage";
import type { UiTheme } from "../../ui/theme";
import type { SettingsState } from "../../ui/useSettings";

const THEMES: UiTheme[] = ["system", "light", "dark", "schedule"];

export function GeneralTab({ state }: { state: SettingsState }) {
  const { settings, keys, update, applyNow } = state;
  const [includeKeys, setIncludeKeys] = useState(false);
  const [message, setMessage] = useState<{ text: string; cls: string }>({ text: "", cls: "" });
  const [origins, setOrigins] = useState<string[]>([]);
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueMsg, setQueueMsg] = useState("");
  const [code, setCode] = useState("");
  const [promo, setPromo] = useState<{ text: string; cls: string }>({ text: "", cls: "" });
  const tier = settings.license.tier;
  const maxConcurrency = maxBatchConcurrency(tier);

  useEffect(() => {
    chrome.permissions.getAll().then((p) => setOrigins(p.origins ?? []));
    void refreshQueue();
  }, []);

  async function refreshQueue() {
    const r = await send({ type: "queue.status" });
    if (r.ok) setQueue(r.status);
  }

  async function flushQueueNow() {
    setQueueBusy(true);
    setQueueMsg("");
    const r = await send({ type: "queue.flush" });
    setQueueBusy(false);
    await refreshQueue();
    if (!r.ok) return setQueueMsg(r.error);
    setQueueMsg(
      r.summary.reachable
        ? t("queue_result", [String(r.summary.added), String(r.summary.duplicates + r.summary.errors + r.summary.held)])
        : t("popup_anki_offline"),
    );
  }

  async function clearQueueNow() {
    if (!window.confirm(t("queue_clear_confirm", [String(queue?.count ?? 0)]))) return;
    await send({ type: "queue.clear" });
    await refreshQueue();
  }

  // Language and theme take effect immediately (persisted right away); bootPage reacts to the change.
  function setUiNow(patch: Partial<Settings["ui"]>) {
    return applyNow({ ...settings, ui: { ...settings.ui, ...patch } });
  }

  async function redeem() {
    const unlocked = await redeemCode(code);
    if (!unlocked) {
      setPromo({ text: t("promo_invalid"), cls: "err" });
      return;
    }
    await applyNow({ ...settings, license: { tier: unlocked, redeemedAt: new Date().toISOString() } });
    setPromo({ text: t("promo_success", [t(`tier_${unlocked}`)]), cls: "ok" });
    setCode("");
  }

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
      <div class="row">
        <label class="field">
          <span>{t("ui_language")}</span>
          <select value={settings.ui.language} onChange={(e) => void setUiNow({ language: e.currentTarget.value })}>
            <option value="auto">{t("ui_language_auto")}</option>
            {UI_LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          <span>{t("ui_theme")}</span>
          <select value={settings.ui.theme} onChange={(e) => void setUiNow({ theme: e.currentTarget.value as UiTheme })}>
            {THEMES.map((v) => (
              <option key={v} value={v}>
                {t(`ui_theme_${v}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {settings.ui.theme === "schedule" && (
        <div class="row schedule">
          <label class="field inline">
            <span>{t("ui_dark_from")}</span>
            <input
              type="time"
              value={settings.ui.themeSchedule.darkFrom}
              onChange={(e) => void setUiNow({ themeSchedule: { ...settings.ui.themeSchedule, darkFrom: e.currentTarget.value || "20:00" } })}
            />
          </label>
          <label class="field inline">
            <span>{t("ui_dark_until")}</span>
            <input
              type="time"
              value={settings.ui.themeSchedule.darkUntil}
              onChange={(e) => void setUiNow({ themeSchedule: { ...settings.ui.themeSchedule, darkUntil: e.currentTarget.value || "07:00" } })}
            />
          </label>
        </div>
      )}
      <div class="hint">{t("ui_language_hint")}</div>

      <label class="field check">
        <input
          type="checkbox"
          checked={settings.ui.offlineQueue}
          onChange={(e) => update((s) => ({ ...s, ui: { ...s.ui, offlineQueue: e.currentTarget.checked } }))}
        />
        <span>{t("opt_offline_queue")}</span>
      </label>
      <div class="hint">{t("opt_offline_queue_hint", [String(QUEUE_LIMIT)])}</div>
      <div class="field">
        <span>{t("queue_title")}</span>
        <div class="hint">
          {queue?.count ? t("queue_pending", [String(queue.count)]) : t("queue_empty")}
          {queue?.words.length ? ` – ${queue.words.slice(0, 8).join(", ")}${queue.words.length > 8 ? "…" : ""}` : ""}
        </div>
        {queue?.profiles.length ? <div class="hint">{t("queue_profiles", [queue.profiles.join(", ")])}</div> : null}
        {queue?.lastError ? <div class="hint err">{queue.lastError}</div> : null}
        <div class="row">
          <button type="button" class="secondary" disabled={!queue?.count || queueBusy} onClick={() => void flushQueueNow()}>
            {queueBusy ? t("queue_flushing") : t("queue_flush")}
          </button>
          <button type="button" class="secondary danger" disabled={!queue?.count} onClick={() => void clearQueueNow()}>
            {t("queue_clear")}
          </button>
          {queueMsg && <span class="hint">{queueMsg}</span>}
        </div>
      </div>

      <div class="field promo">
        <span>{t("promo_title")}</span>
        <div class="hint">
          {t("promo_current_tier")}: <b>{t(`tier_${tier}`)}</b>
        </div>
        <div class="row">
          <input type="text" value={code} placeholder={t("promo_placeholder")} onInput={(e) => setCode(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && void redeem()} />
          <button type="button" class="secondary" disabled={!code.trim()} onClick={() => void redeem()}>
            {t("promo_redeem")}
          </button>
        </div>
        {promo.text && <div class={`hint ${promo.cls}`}>{promo.text}</div>}
        <div class="hint">{t("promo_features")}</div>
      </div>

      <label class="field inline">
        <span>{t("opt_batch_concurrency")}</span>
        <select
          value={Math.min(settings.ui.batchConcurrency, maxConcurrency)}
          onChange={(e) => update((s) => ({ ...s, ui: { ...s.ui, batchConcurrency: Number(e.currentTarget.value) as 1 | 2 | 3 } }))}
        >
          {[1, 2, 3]
            .filter((n) => n <= maxConcurrency)
            .map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
        </select>
        <span class="hint">{t("batch_concurrency_hint")}</span>
      </label>

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
        <input type="checkbox" checked={settings.ui.syncKeys} onChange={(e) => update((s) => ({ ...s, ui: { ...s.ui, syncKeys: e.currentTarget.checked } }))} />
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
