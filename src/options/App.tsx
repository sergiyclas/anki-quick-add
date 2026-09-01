import { useState } from "preact/hooks";
import { t } from "../lib/i18n";
import { useSettings } from "../ui/useSettings";
import { AnkiTab } from "./tabs/Anki";
import { BackupTab } from "./tabs/Backup";
import { GenerationTab } from "./tabs/Generation";
import { PreviewTab } from "./tabs/Preview";
import { ProvidersTab } from "./tabs/Providers";

const TABS = ["providers", "anki", "generation", "preview", "backup"] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [tab, setTab] = useState<Tab>("providers");
  const [savedAt, setSavedAt] = useState(0);
  const state = useSettings();
  if (!state) return null;

  async function save() {
    await state!.save();
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(0), 1500);
  }

  return (
    <>
      <h1>{t("options_title")}</h1>
      <nav class="tabs">
        {TABS.map((id) => (
          <button key={id} class={id === tab ? "active" : ""} onClick={() => setTab(id)}>
            {t(`tab_${id}`)}
          </button>
        ))}
      </nav>
      <section>
        {tab === "providers" && <ProvidersTab state={state} />}
        {tab === "anki" && <AnkiTab state={state} />}
        {tab === "generation" && <GenerationTab state={state} />}
        {tab === "preview" && <PreviewTab state={state} />}
        {tab === "backup" && <BackupTab state={state} />}
      </section>
      <div class="actions">
        <button onClick={save} disabled={!state.dirty}>
          {t("save")}
        </button>
        {savedAt > 0 && <span class="ok">{t("saved")}</span>}
        {state.dirty && <span class="muted">{t("unsaved")}</span>}
      </div>
    </>
  );
}
