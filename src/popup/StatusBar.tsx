import { t } from "../lib/i18n";
import type { PingResponse } from "../lib/messages";

export function StatusBar({ ping }: { ping: PingResponse | null }) {
  if (!ping) return <div class="popup-footer">…</div>;
  const problems: string[] = [];
  if (!ping.anki.ok) problems.push(t("popup_anki_offline"));
  if (!ping.hasKey) problems.push(t("popup_no_key"));
  return (
    <>
      {ping.translator === "downloadable" && (
        <div class="popup-hint">
          <a onClick={() => chrome.runtime.openOptionsPage()}>{t("tr_setup_link")}</a>
        </div>
      )}
      <div class="popup-footer">
      <span class={problems.length ? "err" : ""}>
        {problems.length ? problems.join(" · ") : `${t("popup_anki_ok")} · ${ping.model} · ${ping.deck}`}
      </span>
        <a onClick={() => chrome.runtime.openOptionsPage()}>{t("popup_settings")}</a>
      </div>
    </>
  );
}
