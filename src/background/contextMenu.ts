import { initI18n, t } from "../lib/i18n";
import { type AddResult, addWord } from "../lib/pipeline/addWord";
import { getCache, loadSettings } from "../lib/settings/storage";
import { captureContext } from "./capture";
import { type ToastKind, notify } from "./feedback";
import { openEditor } from "./jobs";

const ROOT = "aqa_root";
const DEFAULT = "aqa_default";
const EDITOR = "aqa_editor";
const DECK_PREFIX = "aqa_deck:";

export interface MenuItem {
  id: string;
  title?: string;
  type?: "separator";
}

// Pure description of the menu, so it can be tested without chrome.*
export function menuItems(decks: string[], defaultDeck: string, limit: number): MenuItem[] {
  const others = decks.filter((d) => d !== defaultDeck).slice(0, Math.max(0, limit));
  const items: MenuItem[] = [{ id: DEFAULT, title: t("ctx_default", [defaultDeck]) }];
  if (others.length) {
    items.push({ id: "aqa_sep1", type: "separator" }, ...others.map((d) => ({ id: `${DECK_PREFIX}${d}`, title: d })));
  }
  items.push({ id: "aqa_sep2", type: "separator" }, { id: EDITOR, title: t("ctx_editor") });
  return items;
}

export async function rebuildMenus(): Promise<void> {
  await initI18n();
  const settings = await loadSettings();
  const decks = (await getCache<string[]>("decks"))?.items ?? [];
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: ROOT, title: t("ctx_root"), contexts: ["selection"] });
  for (const item of menuItems(decks, settings.anki.deck, settings.ui.contextMenuDeckLimit)) {
    chrome.contextMenus.create({
      id: item.id,
      parentId: ROOT,
      contexts: ["selection"],
      ...(item.type === "separator" ? { type: "separator" as const } : { title: item.title }),
    });
  }
}

export function describeResult(result: AddResult): { text: string; kind: ToastKind } {
  switch (result.status) {
    case "added":
    case "updated": {
      const suffix = result.warnings.length ? ` (${result.warnings.join(", ")})` : "";
      return { text: t("popup_added", [result.word, result.summary.translation]) + suffix, kind: "ok" };
    }
    case "queued":
      return { text: t("popup_queued", [result.word, String(result.queued)]), kind: "warn" };
    case "duplicate":
      return { text: t("popup_duplicate", [result.word]), kind: "warn" };
    case "error":
      return { text: result.message, kind: "err" };
  }
}

export async function handleMenuClick(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab | undefined): Promise<void> {
  const word = info.selectionText?.trim();
  const tabId = tab?.id;
  if (!word || tabId === undefined) return;
  const menuId = String(info.menuItemId);
  const context = await captureContext(tabId, info.frameId, word);

  if (menuId === EDITOR) {
    await openEditor({ word, context });
    return;
  }
  const deck = menuId.startsWith(DECK_PREFIX) ? menuId.slice(DECK_PREFIX.length) : undefined;
  await notify(tabId, t("popup_adding", [word]), "info");
  const result = await addWord({ word, context, deck });
  const { text, kind } = describeResult(result);
  await notify(tabId, text, kind);
  if (result.status === "error" && result.action === "openOptions") chrome.runtime.openOptionsPage();
}
