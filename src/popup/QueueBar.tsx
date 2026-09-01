import { useState } from "preact/hooks";
import { t } from "../lib/i18n";
import { send } from "../lib/messages";

// Shown only when cards are waiting for Anki; the flush also runs on an alarm and when the browser starts.
export function QueueBar({ count, onChange }: { count: number; onChange(count: number): void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function flush() {
    setBusy(true);
    setMessage("");
    const r = await send({ type: "queue.flush" });
    setBusy(false);
    if (!r.ok) return setMessage(r.error);
    const { summary } = r;
    onChange(summary.remaining);
    setMessage(
      summary.reachable
        ? t("queue_result", [String(summary.added), String(summary.duplicates + summary.errors + summary.held)])
        : t("popup_anki_offline"),
    );
  }

  if (!count) return null;
  return (
    <div class="popup-queue">
      <span class="warn">{t("queue_pending", [String(count)])}</span>
      <button type="button" class="small" disabled={busy} onClick={flush}>
        {busy ? t("queue_flushing") : t("queue_flush")}
      </button>
      {message && <span class="muted">{message}</span>}
    </div>
  );
}
