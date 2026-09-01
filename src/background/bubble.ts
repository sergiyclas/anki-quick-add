import { loadSettings } from "../lib/settings/storage";

const SCRIPT_ID = "aqa-bubble";
export const ALL_SITES = ["https://*/*", "http://*/*"];

export function hasAllSites(): Promise<boolean> {
  return chrome.permissions.contains({ origins: ALL_SITES });
}

async function isRegistered(): Promise<boolean> {
  const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  return scripts.length > 0;
}

// Dynamically registered scripts only reach pages loaded afterwards; inject into the tabs that are already open
// so the bubble works immediately. Tabs we cannot touch (chrome://, Web Store, PDFs) are skipped.
async function injectIntoOpenTabs(): Promise<number> {
  const tabs = await chrome.tabs.query({ url: ALL_SITES });
  let injected = 0;
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: false }, files: ["content.js"] });
      injected++;
    } catch {
      // restricted page
    }
  }
  return injected;
}

export interface BubbleStatus {
  enabled: boolean;
  permission: boolean;
  registered: boolean;
}

export async function bubbleStatus(): Promise<BubbleStatus> {
  const [settings, permission, registered] = await Promise.all([loadSettings(), hasAllSites(), isRegistered()]);
  return { enabled: settings.ui.selectionBubble, permission, registered };
}

// The selection bubble needs a content script on every page, which is an opt-in: the script is registered
// only while the setting is on and the user has granted access to all sites. Returns the number of open tabs injected.
export async function syncBubbleScript(): Promise<number> {
  const { enabled, permission, registered } = await bubbleStatus();
  const wanted = enabled && permission;
  if (wanted && !registered) {
    await chrome.scripting.registerContentScripts([
      { id: SCRIPT_ID, matches: ALL_SITES, js: ["content.js"], runAt: "document_idle", persistAcrossSessions: true },
    ]);
    return injectIntoOpenTabs();
  }
  if (!wanted && registered) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  return 0;
}
