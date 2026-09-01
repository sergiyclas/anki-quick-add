import { useEffect, useState } from "preact/hooks";
import { t } from "../lib/i18n";
import { type PingResponse, send } from "../lib/messages";
import { BatchAdd } from "./BatchAdd";
import { History } from "./History";
import { QueueList } from "./QueueList";
import { SingleAdd } from "./SingleAdd";
import { StatusBar } from "./StatusBar";

type Mode = "single" | "batch" | "queue";

export function App() {
  const [ping, setPing] = useState<PingResponse | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [deck, setDeck] = useState("");
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    send({ type: "ping" }).then((r) => {
      if (r.ok) {
        setPing(r);
        setDeck((d) => d || r.deck);
        setQueued(r.queued);
      }
    });
    send({ type: "batch.status" }).then((r) => r.ok && r.batch?.running && setMode("batch"));
  }, []);

  return (
    <>
      <div class="popup-modes">
        <a class={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>
          {t("mode_single")}
        </a>
        <a class={mode === "batch" ? "active" : ""} onClick={() => setMode("batch")}>
          {t("mode_batch")}
        </a>
        {(queued > 0 || mode === "queue") && (
          <a class={mode === "queue" ? "active" : ""} onClick={() => setMode("queue")}>
            {t("mode_queue")} <span class="badge">{queued}</span>
          </a>
        )}
      </div>
      {mode === "single" && <SingleAdd deck={deck} onDeckChange={setDeck} quickTranslate={ping?.quickTranslate ?? false} onQueued={setQueued} />}
      {mode === "batch" && <BatchAdd deck={deck} />}
      {mode === "queue" && <QueueList onChange={setQueued} />}
      {mode !== "queue" && <History />}
      <StatusBar ping={ping} />
    </>
  );
}
