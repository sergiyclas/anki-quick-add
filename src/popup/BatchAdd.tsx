import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../lib/i18n";
import { send } from "../lib/messages";
import { type BatchState, splitWords } from "../lib/pipeline/batch";

const ICON: Record<string, string> = { pending: "·", running: "…", added: "✓", updated: "✓", queued: "⏳", duplicate: "=", error: "✗", cancelled: "–" };

function summary(state: BatchState): string {
  const count = (s: string) => state.items.filter((i) => i.status === s).length;
  return t("batch_summary", [String(count("added") + count("updated")), String(count("duplicate")), String(count("error"))]);
}

export function BatchAdd({ deck }: { deck: string }) {
  const [state, setState] = useState<BatchState | null>(null);
  const [text, setText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  async function refresh() {
    const r = await send({ type: "batch.status" });
    if (r.ok) setState(r.batch ?? null);
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(() => void refresh(), 700);
    return () => clearInterval(timer);
  }, []);

  const words = splitWords(text);

  async function start() {
    if (!words.length) return;
    const r = await send({ type: "batch.start", words, deck });
    if (r.ok) {
      setState(r.batch ?? null);
      setText("");
    }
  }

  const finished = state && !state.running;
  const canResume = finished && state.items.some((i) => i.status === "cancelled" || i.status === "error");

  return (
    <div class="batch">
      {(!state || finished) && (
        <>
          <textarea ref={area} rows={4} placeholder={t("batch_placeholder")} value={text} onInput={(e) => setText(e.currentTarget.value)} />
          <div class="row">
            <button type="button" disabled={!words.length} onClick={start}>
              {t("batch_run", [String(words.length)])}
            </button>
            {canResume && (
              <button type="button" class="secondary" onClick={() => send({ type: "batch.resume" }).then(refresh)}>
                {t("batch_resume")}
              </button>
            )}
            {finished && (
              <button type="button" class="secondary" onClick={() => send({ type: "batch.clear" }).then(refresh)}>
                {t("batch_clear")}
              </button>
            )}
          </div>
        </>
      )}
      {state && (
        <>
          <div class="row">
            <span class={finished ? "ok" : "muted"}>{finished ? summary(state) : t("batch_running", [String(state.items.filter((i) => i.status !== "pending" && i.status !== "running").length), String(state.items.length)])}</span>
            {state.running && !state.cancelled && (
              <button type="button" class="secondary small" onClick={() => send({ type: "batch.cancel" }).then(refresh)}>
                {t("batch_cancel")}
              </button>
            )}
          </div>
          <ul class="batch-list">
            {state.items.map((item) => (
              <li key={item.word} class={item.status}>
                <span class="icon">{ICON[item.status]}</span>
                <span class="w">{item.word}</span>
                {item.detail && <span class="d">{item.detail}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
