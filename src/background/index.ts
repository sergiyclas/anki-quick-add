import { initI18n } from "../lib/i18n";
import type { Request } from "../lib/messages";
import { syncBubbleScript } from "./bubble";
import { handleMenuClick, rebuildMenus } from "./contextMenu";
import { flushQueue } from "../lib/queue/flush";
import { refreshBadge } from "../lib/queue/store";
import { handleMessage } from "./router";

// All listeners are registered synchronously at top level so Chrome can wake the worker for them.
const FLUSH_ALARM = "aqa-flush";

// The queue is retried on a timer, and right away whenever the browser (or the worker) starts.
function scheduleFlush(): void {
  void chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 5 });
}

chrome.runtime.onInstalled.addListener(() => void Promise.all([rebuildMenus(), syncBubbleScript(), scheduleFlush(), flushQueue()]));
chrome.runtime.onStartup.addListener(() => void Promise.all([rebuildMenus(), syncBubbleScript(), scheduleFlush(), flushQueue()]));
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) void flushQueue();
});
chrome.permissions.onAdded.addListener(() => void syncBubbleScript());
chrome.permissions.onRemoved.addListener(() => void syncBubbleScript());

void initI18n();
void refreshBadge();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && "settings" in changes) void initI18n().then(rebuildMenus);
  else if (area === "local" && "cache.decks" in changes) void rebuildMenus();
  if (area === "sync" && "settings" in changes) void syncBubbleScript();
});

chrome.contextMenus.onClicked.addListener((info, tab) => void handleMenuClick(info, tab));

chrome.runtime.onMessage.addListener((request: Request, _sender, sendResponse) => {
  handleMessage(request).then(sendResponse, (e: unknown) =>
    sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }),
  );
  return true;
});
