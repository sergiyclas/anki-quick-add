import { useEffect, useState } from "preact/hooks";
import { t } from "../../lib/i18n";
import { send } from "../../lib/messages";

// Chrome downloads the language pack only in response to a real click, and only a full extension page
// gets that gesture - so the download lives here, in the options, not in the popup or the worker.
export function OfflineTranslation({ source, target }: { source: string; target: string }) {
  const supported = typeof Translator !== "undefined";
  const [state, setState] = useState<AIAvailability | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [abort, setAbort] = useState<AbortController | null>(null);

  useEffect(() => {
    if (!supported) return;
    setPercent(null);
    setError("");
    Translator.availability({ sourceLanguage: source, targetLanguage: target }).then(setState, () => setState("unavailable"));
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
      setError(e instanceof Error ? e.message : String(e));
      setState(await Translator.availability({ sourceLanguage: source, targetLanguage: target }).catch(() => "unavailable" as const));
    } finally {
      setPercent(null);
      setAbort(null);
    }
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
          {error && <div class="hint err">{t("tr_download_failed", [error])}</div>}
          <div class="hint">{t("tr_offline_hint")}</div>
        </>
      )}
    </div>
  );
}
