import { useEffect, useState } from "preact/hooks";
import { t } from "../lib/i18n";
import { type PingResponse, send } from "../lib/messages";
import { BatchAdd } from "./BatchAdd";
import { History } from "./History";
import { SingleAdd } from "./SingleAdd";
import { StatusBar } from "./StatusBar";

type Mode = "single" | "batch";

export function App() {
  const [ping, setPing] = useState<PingResponse | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [deck, setDeck] = useState("");

  useEffect(() => {
    send({ type: "ping" }).then((r) => {
      if (r.ok) {
        setPing(r);
        setDeck((d) => d || r.deck);
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
      </div>
      {mode === "single" ? <SingleAdd deck={deck} onDeckChange={setDeck} quickTranslate={ping?.quickTranslate ?? false} /> : <BatchAdd deck={deck} />}
      <History />
      <StatusBar ping={ping} />
    </>
  );
}
