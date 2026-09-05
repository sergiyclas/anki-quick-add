import { useEffect, useState } from "preact/hooks";
import { t } from "../../lib/i18n";
import { languageByCode } from "../../lib/languages";
import { send } from "../../lib/messages";

// Chrome downloads the language pack only in response to a real click, and only a full extension page
// gets that gesture - so the download lives here, in the options, not in the popup or the worker.
export function OfflineTranslation({ source, target }: { source: string; target: string }) {
  const supported = typeof Translator !== "undefined";
  const [state, setState] = useState<AIAvailability | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [abort, setAbort] = useState<AbortController | null>(null);
  const [tested, setTested] = useState<string[]>([]);

  useEffect(() => {
    if (!supported) return;
    setPercent(null);
    setError("");
    Translator.availability({ sourceLanguage: source, targetLanguage: target }).then(async (availability) => {
      setState(availability);
      // The worker caches this state for its own fallback; the page is the one that just measured it.
      if (availability === "available") await send({ type: "translate.ready", source, target });
    }, () => setState("unavailable"));
  }, [source, target]);

  async function download() {
    const controller = new AbortController();
    setAbort(controller);
    setError("");
    setPercent(0);
    try {
      const translator = await Translator.create({
        sourceLanguage: source,
        targetLanguage: target,
        monitor: (m) => m.addEventListener("downloadprogress", (e) => setPercent(Math.round(e.loaded * 100))),
        signal: controller.signal,
      });
      translator.destroy();
      setState("available");
      await send({ type: "translate.ready", source, target });
    } catch (e) {
      // Chrome sometimes rejects create() even though the pack did land; the state decides, not the error.
      const now = await Translator.availability({ sourceLanguage: source, targetLanguage: target }).catch(() => "unavailable" as const);
      setState(now);
      if (now === "available") await send({ type: "translate.ready", source, target });
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPercent(null);
      setAbort(null);
    }
  }

  // Proves the whole offline path: options page -> worker -> offscreen document -> on-device model.
  // The word has to be in the source language - the model is built for that pair. A second line with
  // the English word tells a broken pack apart from a pack for a different pair: if the English word
  // comes back right while the source-language one does not, the model is not the one we asked for.
  async function test() {
    const word = languageByCode(source).sample;
    const words = source === "en" ? [word] : [word, languageByCode("en").sample];
    setTested(["…"]);
    const lines: string[] = [];
    for (const text of words) {
      const r = await send({ type: "translate.device", text });
      lines.push(r.ok ? `${text} → ${r.translation}` : `${text} → ${r.error}`);
    }
    setTested(lines);
  }

  const pair = t("tr_pair", [source.toUpperCase(), target.toUpperCase()]);
  return (
    <div class="field">
      <span>{t("tr_offline_title")}</span>
      {!supported ? (
        <div class="hint">{t("tr_unsupported")}</div>
      ) : (
        <>
          <div class={`hint ${state === "available" ? "ok" : ""}`}>
            {pair}: {state ? t(`tr_state_${state}`) : "…"}
          </div>
          {percent !== null ? (
            <div class="row">
              <progress value={percent} max={100} />
              <span class="hint">{percent}%</span>
              <button type="button" class="secondary" onClick={() => abort?.abort()}>
                {t("tr_cancel")}
              </button>
            </div>
          ) : (
            (state === "downloadable" || state === "downloading") && (
              <button type="button" class="secondary" onClick={() => void download()}>
                {t("tr_download")}
              </button>
            )
          )}
          {state === "available" && (
            <div class="row">
              <button type="button" class="secondary" onClick={() => void test()}>
                {t("tr_test")}
              </button>
              {tested.map((line) => (
                <span key={line} class="hint">
                  {line}
                </span>
              ))}
            </div>
          )}
          {error && <div class="hint err">{t("tr_download_failed", [error])}</div>}
          <div class="hint">{t("tr_offline_hint")}</div>
        </>
      )}
    </div>
  );
}
