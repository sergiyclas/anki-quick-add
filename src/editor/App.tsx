import { useEffect, useState } from "preact/hooks";
import type { Job } from "../background/jobs";
import type { CardData, ExampleItem } from "../lib/generation/types";
import { t } from "../lib/i18n";
import { send } from "../lib/messages";
import type { AddResult } from "../lib/pipeline/addWord";

const jobId = new URLSearchParams(location.search).get("job") ?? "";

function useJob(id: string): Job | undefined {
  const [job, setJob] = useState<Job>();
  useEffect(() => {
    const key = `job:${id}`;
    chrome.storage.session.get(key).then((s) => setJob(s[key] as Job | undefined));
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "session" && changes[key]) setJob(changes[key].newValue as Job | undefined);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [id]);
  return job;
}

function useDecks(): string[] {
  const [decks, setDecks] = useState<string[]>([]);
  useEffect(() => {
    send({ type: "decks.list" }).then((r) => r.ok && setDecks(r.items));
  }, []);
  return decks;
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function resultText(result: AddResult): string {
  switch (result.status) {
    case "added":
    case "updated":
      return t("popup_added", [result.word, result.summary.translation]);
    case "duplicate":
      return t("popup_duplicate", [result.word]);
    case "error":
      return result.message;
  }
}

export function App() {
  const job = useJob(jobId);
  const decks = useDecks();
  const [card, setCard] = useState<CardData | null>(null);
  const [deck, setDeck] = useState("");
  const [tags, setTags] = useState("");
  const [dropAudio, setDropAudio] = useState(false);
  const [dropImage, setDropImage] = useState(false);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AddResult | null>(null);

  useEffect(() => {
    if (job?.status === "ready" && job.prepared) {
      setCard(job.prepared.card);
      setDeck(job.prepared.deck);
      setTags(job.prepared.tags.join(", "));
      setDropAudio(false);
      setDropImage(false);
    }
  }, [job?.status, job?.prepared]);

  if (!jobId) return <p class="err">{t("editor_no_job")}</p>;
  if (!job) return <p class="muted">…</p>;

  const prepared = job.prepared;
  const audio = prepared?.media.find((m) => m.kind === "audio");
  const image = prepared?.media.find((m) => m.kind === "image");
  const setField = <K extends keyof CardData>(key: K, value: CardData[K]) => setCard((c) => (c ? { ...c, [key]: value } : c));
  const setExample = (i: number, patch: Partial<ExampleItem>) =>
    setCard((c) => (c ? { ...c, examples: c.examples.map((e, j) => (j === i ? { ...e, ...patch } : e)) } : c));

  async function regenerate() {
    setBusy(true);
    setResult(null);
    await send({ type: "job.regenerate", id: jobId, hint });
    setBusy(false);
  }

  async function add() {
    if (!card) return;
    setBusy(true);
    const r = await send({
      type: "job.commit",
      id: jobId,
      overrides: { card, deck, tags: tags.split(/[,\s]+/).filter(Boolean), dropAudio, dropImage },
    });
    setBusy(false);
    if (!r.ok) {
      setResult({ status: "error", word: job!.request.word, step: "write", message: r.error });
      return;
    }
    setResult(r.result);
    if (r.result.status !== "error") setTimeout(() => window.close(), 1500);
  }

  return (
    <div class="editor">
      <h1>
        {t("editor_title")}: <span class="word">{job.request.word}</span>
      </h1>
      {job.request.context && <p class="context muted">“{job.request.context}”</p>}

      {job.status === "generating" && <p class="muted">{t("editor_generating")}</p>}
      {job.status === "error" && <p class="err">{job.result ? resultText(job.result) : job.error}</p>}

      {card && (
        <>
          <label class="field">
            <span>{t("slot_translations")}</span>
            <textarea rows={2} value={card.translations.join("\n")} onInput={(e) => setField("translations", lines(e.currentTarget.value))} />
          </label>
          {card.transcription !== undefined && (
            <label class="field">
              <span>{t("slot_transcription")}</span>
              <input type="text" value={card.transcription} onInput={(e) => setField("transcription", e.currentTarget.value)} />
            </label>
          )}
          {card.partOfSpeech !== undefined && (
            <label class="field">
              <span>{t("slot_partOfSpeech")}</span>
              <input type="text" value={card.partOfSpeech} onInput={(e) => setField("partOfSpeech", e.currentTarget.value)} />
            </label>
          )}
          {card.definition !== undefined && (
            <label class="field">
              <span>{t("slot_definition")}</span>
              <textarea rows={2} value={card.definition} onInput={(e) => setField("definition", e.currentTarget.value)} />
            </label>
          )}
          {card.synonyms !== undefined && (
            <label class="field">
              <span>{t("slot_synonyms")}</span>
              <input
                type="text"
                value={card.synonyms.join(", ")}
                onInput={(e) => setField("synonyms", e.currentTarget.value.split(",").map((s) => s.trim()).filter(Boolean))}
              />
            </label>
          )}
          <div class="field">
            <span>{t("slot_examples")}</span>
            {card.examples.map((ex, i) => (
              <div key={i} class="example">
                <input type="text" value={ex.text} onInput={(e) => setExample(i, { text: e.currentTarget.value })} />
                {ex.translation !== undefined && (
                  <input type="text" class="tr" value={ex.translation} onInput={(e) => setExample(i, { translation: e.currentTarget.value })} />
                )}
              </div>
            ))}
          </div>
          {card.grammar !== undefined && (
            <label class="field">
              <span>{t("slot_grammar")}</span>
              <textarea rows={2} value={card.grammar} onInput={(e) => setField("grammar", e.currentTarget.value)} />
            </label>
          )}

          <div class="media">
            {audio && (
              <label class="check">
                <input type="checkbox" checked={!dropAudio} onChange={(e) => setDropAudio(!e.currentTarget.checked)} />
                <span>{t("slot_audio")}</span>
                <audio controls src={`data:${audio.mime};base64,${audio.data}`} />
              </label>
            )}
            {image && (
              <label class="check image">
                <input type="checkbox" checked={!dropImage} onChange={(e) => setDropImage(!e.currentTarget.checked)} />
                <span>{t("slot_image")}</span>
                <img src={`data:${image.mime};base64,${image.data}`} alt="" />
              </label>
            )}
          </div>

          <div class="row">
            <label class="field">
              <span>{t("opt_deck")}</span>
              <select value={deck} onChange={(e) => setDeck(e.currentTarget.value)}>
                {(decks.includes(deck) ? decks : [deck, ...decks]).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label class="field">
              <span>{t("editor_extra_tags")}</span>
              <input type="text" value={tags} onInput={(e) => setTags(e.currentTarget.value)} />
            </label>
          </div>
        </>
      )}

      <div class="row regen">
        <input type="text" placeholder={t("editor_hint_placeholder")} value={hint} onInput={(e) => setHint(e.currentTarget.value)} />
        <button type="button" class="secondary" disabled={busy || job.status === "generating"} onClick={regenerate}>
          {t("editor_regenerate")}
        </button>
      </div>

      <div class="actions">
        <button type="button" disabled={busy || !card || job.status !== "ready"} onClick={add}>
          {t("editor_add")}
        </button>
        {result && <span class={result.status === "error" ? "err" : result.status === "duplicate" ? "warn" : "ok"}>{resultText(result)}</span>}
      </div>
    </div>
  );
}
