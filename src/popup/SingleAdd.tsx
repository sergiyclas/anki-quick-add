import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../lib/i18n";
import { send } from "../lib/messages";
import type { AddResult } from "../lib/pipeline/addWord";

interface Status {
  text: string;
  cls: "" | "ok" | "warn" | "err";
}

function describe(result: AddResult): Status {
  switch (result.status) {
    case "added":
    case "updated": {
      const suffix = result.warnings.length ? ` (${result.warnings.join(", ")})` : "";
      return { text: t("popup_added", [result.word, result.summary.translation]) + suffix, cls: "ok" };
    }
    case "queued":
      return { text: t("popup_queued", [result.word, String(result.queued)]), cls: "warn" };
    case "duplicate":
      return { text: t("popup_duplicate", [result.word]), cls: "warn" };
    case "error":
      return { text: result.message, cls: "err" };
  }
}

export function SingleAdd({
  deck,
  onDeckChange,
  quickTranslate,
  onQueued,
}: {
  deck: string;
  onDeckChange(deck: string): void;
  quickTranslate: boolean;
  onQueued(count: number): void;
}) {
  const [status, setStatus] = useState<Status>({ text: "", cls: "" });
  const [busy, setBusy] = useState(false);
  const [decks, setDecks] = useState<string[]>([]);
  const [preview, setPreview] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const previewTimer = useRef<number>(0);

  function onType() {
    if (!quickTranslate) return;
    const text = input.current?.value.trim() ?? "";
    window.clearTimeout(previewTimer.current);
    if (!text) return setPreview("");
    previewTimer.current = window.setTimeout(async () => {
      const r = await send({ type: "translate.quick", text });
      if (r.ok && input.current?.value.trim() === text) setPreview(r.translation);
    }, 300);
  }

  useEffect(() => {
    send({ type: "decks.list" }).then((r) => r.ok && setDecks(r.items));
  }, []);

  async function submit(editor: boolean) {
    const word = input.current?.value.trim() ?? "";
    if (!word || busy) return;
    if (editor) {
      await send({ type: "editor.open", word, deck });
      window.close();
      return;
    }
    setBusy(true);
    setStatus({ text: t("popup_adding", [word]), cls: "" });
    const response = await send({ type: "add", word, deck });
    setBusy(false);
    if (!response.ok) {
      setStatus({ text: response.error, cls: "err" });
      return;
    }
    const result = response.result;
    setStatus(describe(result));
    if (result.status === "queued") onQueued(result.queued);
    if (result.status === "added" || result.status === "updated" || result.status === "queued") {
      if (input.current) input.current.value = "";
      setPreview("");
    } else if (result.status === "error" && result.action === "openOptions") {
      chrome.runtime.openOptionsPage();
    }
    input.current?.focus();
  }

  return (
    <>
      <input
        ref={input}
        class="popup-input"
        type="text"
        placeholder={t("popup_placeholder")}
        autofocus
        disabled={busy}
        onKeyDown={(e) => e.key === "Enter" && submit(e.shiftKey)}
        onInput={onType}
      />
      {preview && <div class="popup-preview">{preview}</div>}
      <div class="popup-row">
        <select value={deck} onChange={(e) => onDeckChange(e.currentTarget.value)} title={t("opt_deck")}>
          {(decks.includes(deck) || !deck ? decks : [deck, ...decks]).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span class="muted">{t("popup_shift_enter")}</span>
      </div>
      <div class={`popup-status ${status.cls}`}>{status.text}</div>
    </>
  );
}
