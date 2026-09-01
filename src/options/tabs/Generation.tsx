import { useEffect, useState } from "preact/hooks";
import { t } from "../../lib/i18n";
import { type BubbleStatusResponse, send } from "../../lib/messages";
import { saveSettings } from "../../lib/settings/storage";
import type { BubbleTrigger, Cefr, GenerationSettings, Settings } from "../../lib/settings/schema";
import { ALL_SITES } from "../../background/bubble";
import type { SettingsState } from "../../ui/useSettings";
import { LanguageSelect } from "../components/LanguageSelect";

const LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const TOGGLES: (keyof GenerationSettings)[] = ["transcription", "partOfSpeech", "definition", "synonyms", "grammar", "exampleTranslations"];

function Count({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange(v: number): void }) {
  return (
    <label class="field inline">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onInput={(e) => onChange(Math.min(max, Math.max(min, Number(e.currentTarget.value) || min)))}
      />
    </label>
  );
}

export function GenerationTab({ state }: { state: SettingsState }) {
  const { settings, update } = state;
  const g = settings.generation;
  const setGen = (patch: Partial<GenerationSettings>) => update((s) => ({ ...s, generation: { ...s.generation, ...patch } }));
  const setMedia = (patch: (m: Settings["media"]) => Settings["media"]) => update((s) => ({ ...s, media: patch(s.media) }));
  const audio = settings.media.audio;
  const image = settings.media.image;
  const [bubbleDenied, setBubbleDenied] = useState(false);
  const [bubble, setBubble] = useState<BubbleStatusResponse | null>(null);
  const setUi = (patch: Partial<Settings["ui"]>) => update((s) => ({ ...s, ui: { ...s.ui, ...patch } }));

  useEffect(() => {
    send({ type: "bubble.status" }).then((r) => r.ok && setBubble(r));
  }, []);

  // The toggle is persisted right away (not on Save): the permission prompt already was the user's decision,
  // and the worker registers the script and injects it into open tabs as soon as the setting is stored.
  async function toggleBubble(on: boolean) {
    if (on) {
      // permissions.request must run inside the click handler (user gesture).
      const granted = await chrome.permissions.request({ origins: ALL_SITES });
      setBubbleDenied(!granted);
      if (!granted) return;
    }
    setUi({ selectionBubble: on });
    await saveSettings({ ...settings, ui: { ...settings.ui, selectionBubble: on } });
    const r = await send({ type: "bubble.sync" });
    if (r.ok) setBubble(r);
  }

  const bubbleStatusText = bubble
    ? [
        `${t("bubble_permission")}: ${bubble.permission ? "✓" : "✗"}`,
        `${t("bubble_registered")}: ${bubble.registered ? "✓" : "✗"}`,
        bubble.injected !== undefined ? t("bubble_injected", [String(bubble.injected)]) : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  function moveSource(index: number, delta: number) {
    const order = [...audio.order];
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target]!, order[index]!];
    setMedia((m) => ({ ...m, audio: { ...m.audio, order } }));
  }

  return (
    <>
      <div class="row">
        <label class="field">
          <span>{t("gen_source")}</span>
          <LanguageSelect value={settings.languages.source} onChange={(source) => update((s) => ({ ...s, languages: { ...s.languages, source } }))} />
        </label>
        <label class="field">
          <span>{t("gen_target")}</span>
          <LanguageSelect value={settings.languages.target} onChange={(target) => update((s) => ({ ...s, languages: { ...s.languages, target } }))} />
        </label>
      </div>

      <label class="field">
        <span>{t("gen_level")}</span>
        <select value={g.level} onChange={(e) => setGen({ level: e.currentTarget.value as Cefr })}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <div class="hint">{t("gen_level_hint")}</div>
      </label>

      <div class="row counts">
        <Count label={t("gen_translations_count")} value={g.translationsCount} min={1} max={5} onChange={(v) => setGen({ translationsCount: v })} />
        <Count label={t("gen_examples_count")} value={g.examplesCount} min={0} max={6} onChange={(v) => setGen({ examplesCount: v })} />
        <Count label={t("gen_synonyms_count")} value={g.synonymsCount} min={1} max={10} onChange={(v) => setGen({ synonymsCount: v })} />
      </div>

      <div class="field">
        <span>{t("gen_parts")}</span>
        {TOGGLES.map((key) => (
          <label key={key} class="check">
            <input type="checkbox" checked={Boolean(g[key])} onChange={(e) => setGen({ [key]: e.currentTarget.checked } as Partial<GenerationSettings>)} />
            <span>{t(`gen_${key}`)}</span>
          </label>
        ))}
      </div>

      <label class="field">
        <span>{t("gen_extra")}</span>
        <textarea rows={3} value={g.extraInstructions} onInput={(e) => setGen({ extraInstructions: e.currentTarget.value })} />
        <div class="hint">{t("gen_extra_hint")}</div>
      </label>

      <div class="field">
        <span>{t("ui_on_pages")}</span>
        <label class="check">
          <input type="checkbox" checked={settings.ui.quickTranslate} onChange={(e) => setUi({ quickTranslate: e.currentTarget.checked })} />
          <span>{t("ui_quick_translate")}</span>
        </label>
        <label class="check">
          <input type="checkbox" checked={settings.ui.selectionBubble} onChange={(e) => void toggleBubble(e.currentTarget.checked)} />
          <span>{t("ui_selection_bubble")}</span>
        </label>
        <div class="hint">{t("ui_selection_bubble_hint")}</div>
        {bubbleDenied && <div class="hint err">{t("ui_selection_bubble_denied")}</div>}
        {settings.ui.selectionBubble && bubble && (
          <div class={`hint ${bubble.permission && bubble.registered ? "ok" : "err"}`}>{bubbleStatusText}</div>
        )}
        {settings.ui.selectionBubble && <div class="hint">{t("bubble_restricted_hint")}</div>}
        {settings.ui.selectionBubble && (
          <label class="field inline">
            <span>{t("ui_bubble_trigger")}</span>
            <select value={settings.ui.bubbleTrigger} onChange={(e) => setUi({ bubbleTrigger: e.currentTarget.value as BubbleTrigger })}>
              <option value="shift">{t("trigger_shift")}</option>
              <option value="alt">{t("trigger_alt")}</option>
              <option value="always">{t("trigger_always")}</option>
            </select>
          </label>
        )}
        <div class="hint">{t("cmd_hint")}</div>
      </div>

      <div class="field">
        <label class="check">
          <input type="checkbox" checked={audio.enabled} onChange={(e) => setMedia((m) => ({ ...m, audio: { ...m.audio, enabled: e.currentTarget.checked } }))} />
          <span>{t("media_audio")}</span>
        </label>
        {audio.enabled && (
          <div class="sub">
            <div class="hint">{t("media_audio_order_hint")}</div>
            <ol class="order">
              {audio.order.map((id, i) => (
                <li key={id}>
                  <span>{t(`audio_${id}`)}</span>
                  <button type="button" class="secondary small" disabled={i === 0} onClick={() => moveSource(i, -1)}>
                    ↑
                  </button>
                  <button type="button" class="secondary small" disabled={i === audio.order.length - 1} onClick={() => moveSource(i, 1)}>
                    ↓
                  </button>
                </li>
              ))}
            </ol>
            <label class="check">
              <input type="checkbox" checked={audio.allowOgg} onChange={(e) => setMedia((m) => ({ ...m, audio: { ...m.audio, allowOgg: e.currentTarget.checked } }))} />
              <span>{t("media_allow_ogg")}</span>
            </label>
          </div>
        )}
      </div>

      <div class="field">
        <label class="check">
          <input type="checkbox" checked={image.enabled} onChange={(e) => setMedia((m) => ({ ...m, image: { ...m.image, enabled: e.currentTarget.checked } }))} />
          <span>{t("media_image")}</span>
        </label>
        {image.enabled && (
          <div class="sub">
            <div class="hint">{t("media_image_hint")}</div>
            <Count label={t("media_image_width")} value={image.maxWidth} min={160} max={1024} onChange={(v) => setMedia((m) => ({ ...m, image: { ...m.image, maxWidth: v } }))} />
            <label class="check">
              <input type="checkbox" checked={image.storeCredit} onChange={(e) => setMedia((m) => ({ ...m, image: { ...m.image, storeCredit: e.currentTarget.checked } }))} />
              <span>{t("media_store_credit")}</span>
            </label>
          </div>
        )}
      </div>
    </>
  );
}


