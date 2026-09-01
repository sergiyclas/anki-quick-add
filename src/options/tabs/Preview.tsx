import { useEffect, useMemo, useState } from "preact/hooks";
import { BUILTIN_CSS, BUILTIN_TEMPLATES } from "../../lib/anki/builtinModel";
import type { ModelTemplates } from "../../lib/anki/types";
import { t } from "../../lib/i18n";
import { send } from "../../lib/messages";
import { isFieldEmpty, renderTemplate } from "../../lib/note/mustache";
import { samplePreviewFields } from "../../lib/note/sample";
import { BUILTIN_MODEL_NAME } from "../../lib/settings/schema";
import type { SettingsState } from "../../ui/useSettings";

interface Loaded {
  templates: ModelTemplates;
  css: string;
}

export function PreviewTab({ state }: { state: SettingsState }) {
  const { settings, mapping } = state;
  const modelName = settings.anki.modelName;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [cardName, setCardName] = useState("");
  const [side, setSide] = useState<"front" | "back">("back");
  const [night, setNight] = useState(false);

  useEffect(() => {
    setLoaded(null);
    setError("");
    send({ type: "model.templates", modelName }).then((r) => {
      if (r.ok) {
        setLoaded({ templates: r.templates, css: r.css });
      } else if (modelName === BUILTIN_MODEL_NAME) {
        setLoaded({ templates: Object.fromEntries(BUILTIN_TEMPLATES.map((x) => [x.Name, { Front: x.Front, Back: x.Back }])), css: BUILTIN_CSS });
      } else {
        setError(r.error);
      }
    });
  }, [modelName]);

  const cards = loaded ? Object.keys(loaded.templates) : [];
  const current = cards.includes(cardName) ? cardName : (cards[0] ?? "");

  const rendered = useMemo(() => {
    if (!loaded || !mapping || !current) return null;
    const fields = samplePreviewFields(settings, mapping);
    const tpl = loaded.templates[current]!;
    const ctx = { fields, card: current, deck: settings.anki.deck, type: modelName, tags: ["aqa"] };
    const front = renderTemplate(tpl.Front, ctx);
    const back = renderTemplate(tpl.Back, { ...ctx, frontSide: front });
    return { front, back, generated: !isFieldEmpty(front) };
  }, [loaded, mapping, current, settings, modelName]);

  const srcdoc = rendered
    ? `<!doctype html><html><head><meta charset="utf-8"><style>${loaded!.css}</style><style>html,body{margin:0}</style></head>` +
      `<body class="card ${night ? "night_mode nightMode" : ""}">${side === "front" ? rendered.front : rendered.back}</body></html>`
    : "";

  return (
    <>
      <div class="row preview-controls">
        <select value={current} onChange={(e) => setCardName(e.currentTarget.value)}>
          {cards.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="button" class={side === "front" ? "" : "secondary"} onClick={() => setSide("front")}>
          {t("preview_front")}
        </button>
        <button type="button" class={side === "back" ? "" : "secondary"} onClick={() => setSide("back")}>
          {t("preview_back")}
        </button>
        <label class="check">
          <input type="checkbox" checked={night} onChange={(e) => setNight(e.currentTarget.checked)} />
          <span>{t("preview_night")}</span>
        </label>
      </div>
      {error && <div class="hint err">{error}</div>}
      {rendered && !rendered.generated && <div class="hint warn">{t("preview_not_generated")}</div>}
      {rendered && <iframe class="preview-frame" sandbox="" srcdoc={srcdoc} title="card preview" />}
      <div class="hint">{t("preview_hint")}</div>
    </>
  );
}
