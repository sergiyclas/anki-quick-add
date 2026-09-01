import { useEffect, useState } from "preact/hooks";
import { t } from "../lib/i18n";
import { send } from "../lib/messages";
import type { QueueItemInfo } from "../lib/queue/store";

function ago(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return t("queue_now");
  if (minutes < 60) return t("queue_minutes", [String(minutes)]);
  const hours = Math.round(minutes / 60);
  return hours < 24 ? t("queue_hours", [String(hours)]) : t("queue_days", [String(Math.round(hours / 24))]);
}

export function QueueList({ onChange }: { onChange(count: number): void }) {
  const [items, setItems] = useState<QueueItemInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; cls: string }>({ text: "", cls: "" });

  async function refresh() {
    const r = await send({ type: "queue.status" });
    if (!r.ok) return;
    setItems(r.status.items);
    onChange(r.status.items.length);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function flush() {
    setBusy(true);
    setMessage({ text: "", cls: "" });
    const r = await send({ type: "queue.flush" });
    setBusy(false);
    await refresh();
    if (!r.ok) return setMessage({ text: r.error, cls: "err" });
    const { summary } = r;
    if (!summary.reachable) return setMessage({ text: t("queue_still_closed"), cls: "warn" });
    setMessage({
      text: t("queue_result", [String(summary.added), String(summary.remaining)]),
      cls: summary.remaining ? "warn" : "ok",
    });
  }

  async function remove(id: string) {
    await send({ type: "queue.remove", id });
    await refresh();
  }

  if (!items) return <div class="queue-empty muted">…</div>;
  if (!items.length) {
    return (
      <div class="queue-empty">
        <div class="queue-empty-title">{t("queue_empty")}</div>
        <div class="muted">{t("queue_empty_hint")}</div>
      </div>
    );
  }

  return (
    <div class="queue">
      <div class="queue-head">
        <span class="warn">{t("queue_pending", [String(items.length)])}</span>
        <button type="button" class="small" disabled={busy} onClick={() => void flush()}>
          {busy ? t("queue_flushing") : t("queue_flush")}
        </button>
      </div>
      <ul class="queue-list">
        {items.map((item) => (
          <li key={item.id} class={item.lastError ? "err-item" : ""}>
            <div class="queue-word">
              <b>{item.word}</b>
              <span class="queue-media">
                {item.hasAudio && <span title={t("queue_has_audio")}>♪</span>}
                {item.hasImage && <span title={t("queue_has_image")}>▣</span>}
              </span>
              <span class="queue-when muted">{ago(item.at)}</span>
              <a class="queue-drop" title={t("queue_remove")} onClick={() => void remove(item.id)}>
                ✕
              </a>
            </div>
            <div class="queue-translation muted">{item.lastError ?? item.translation}</div>
          </li>
        ))}
      </ul>
      <div class="queue-foot">
        {message.text && <span class={message.cls}>{message.text}</span>}
        <a
          class="muted"
          onClick={async () => {
            if (!window.confirm(t("queue_clear_confirm", [String(items.length)]))) return;
            await send({ type: "queue.clear" });
            await refresh();
          }}
        >
          {t("queue_clear")}
        </a>
      </div>
    </div>
  );
}
