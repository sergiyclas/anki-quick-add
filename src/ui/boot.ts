import { initI18n, loadUiLanguage } from "../lib/i18n";
import type { Settings } from "../lib/settings/schema";
import { loadSettings } from "../lib/settings/storage";
import { applyUiTheme } from "./theme";

// Shared start-up for popup, options and editor: pick up the UI language and theme before the first
// render, and keep following them while the page is open (a change in another tab, the schedule ticking).
export async function bootPage(render: () => void): Promise<void> {
  const settings = await loadSettings();
  applyUiTheme(settings);
  await initI18n();
  render();

  let current: Settings = settings;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes["settings"]) return;
    loadSettings().then(async (next) => {
      const languageChanged = next.ui.language !== current.ui.language;
      current = next;
      applyUiTheme(next);
      if (languageChanged) {
        await loadUiLanguage(next.ui.language);
        render(); // same tree, re-rendered: t() picks up the new strings, unsaved edits survive
      }
    });
  });
  setInterval(() => applyUiTheme(current), 60_000);
}
