import { type OffscreenRequest, type OffscreenResponse, isOffscreenRequest } from "../lib/translate/protocol";
import { availability, releaseAll, translate } from "./translator";

async function handle(request: OffscreenRequest): Promise<OffscreenResponse> {
  switch (request.kind) {
    case "translator.availability":
      return { ok: true, availability: await availability(request.from, request.to) };
    case "translator.translate":
      return { ok: true, text: await translate(request.text, request.from, request.to) };
    case "translator.release":
      releaseAll();
      return { ok: true };
  }
}

// Returning false for anything else is load-bearing: the popup broadcasts its own messages to every
// context, and a reply from here would race the service worker's.
chrome.runtime.onMessage.addListener((request: unknown, _sender, sendResponse) => {
  if (!isOffscreenRequest(request)) return false;
  handle(request).then(sendResponse, (e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  return true;
});
