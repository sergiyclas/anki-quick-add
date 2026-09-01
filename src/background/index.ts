import type { Request } from "../lib/messages";
import { syncBubbleScript } from "./bubble";
import { handleMenuClick, rebuildMenus } from "./contextMenu";
import { handleMessage } from "./router";

// All listeners are registered synchronously at top level so Chrome can wake the worker for them.
chrome.runtime.onInstalled.addListener(() => void Promise.all([rebuildMenus(), syncBubbleScript()]));
chrome.runtime.onStartup.addListener(() => void Promise.all([rebuildMenus(), syncBubbleScript()]));
chrome.permissions.onAdded.addListener(() => void syncBubbleScript());
chrome.permissions.onRemoved.addListener(() => void syncBubbleScript());

chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === "local" && "cache.decks" in changes) || (area === "sync" && "settings" in changes)) void rebuildMenus();
  if (area === "sync" && "settings" in changes) void syncBubbleScript();
});

chrome.contextMenus.onClicked.addListener((info, tab) => void handleMenuClick(info, tab));

chrome.runtime.onMessage.addListener((request: Request, _sender, sendResponse) => {
  handleMessage(request).then(sendResponse, (e: unknown) =>
    sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }),
  );
  return true;
});
