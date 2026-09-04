// Service-worker side of the offscreen document: create it on demand, talk to it, close it when idle.

import { OFFSCREEN_PATH, type OffscreenRequest, type OffscreenResponse } from "./protocol";

let creating: Promise<void> | null = null;

async function hasDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType] });
  return contexts.length > 0;
}

export async function ensureTranslatorDocument(): Promise<void> {
  if (await hasDocument()) return;
  if (creating) return creating;
  creating = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: "The built-in Translator API is only available to documents, not to the service worker.",
    })
    .catch((e: unknown) => {
      // Another wake-up may have created it in the meantime; anything else is a real failure.
      if (!String(e).includes("Only a single offscreen document")) throw e;
    })
    .finally(() => {
      creating = null;
    });
  return creating;
}

export async function closeTranslatorDocument(): Promise<void> {
  if (!(await hasDocument())) return;
  await chrome.offscreen.closeDocument().catch(() => undefined);
}

export async function askOffscreen(request: OffscreenRequest): Promise<OffscreenResponse> {
  await ensureTranslatorDocument();
  // The document may still be booting when the first message goes out.
  for (let attempt = 0; ; attempt++) {
    try {
      return (await chrome.runtime.sendMessage(request)) as OffscreenResponse;
    } catch (e) {
      if (attempt >= 5 || !String(e).includes("Receiving end does not exist")) throw e;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
