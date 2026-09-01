import { extractSentence } from "../lib/text";

// Injected into the page: must be self-contained (no imports, no closures).
function captureSelectionInPage(): { selection: string; block: string } {
  const sel = window.getSelection();
  const selection = sel?.toString() ?? "";
  let node: Node | null = sel?.anchorNode ?? null;
  while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
  let el = node as Element | null;
  const BLOCK = /^(P|LI|DIV|TD|TH|BLOCKQUOTE|H[1-6]|ARTICLE|SECTION|DD|DT|PRE|FIGCAPTION|CAPTION|BODY)$/;
  while (el && !BLOCK.test(el.tagName)) el = el.parentElement;
  return { selection, block: (el?.textContent ?? "").slice(0, 4000) };
}

// The sentence around the current selection in the given frame, or "" when it cannot be determined.
export async function captureContext(tabId: number, frameId: number | undefined, selectionText: string): Promise<string> {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId, ...(frameId !== undefined ? { frameIds: [frameId] } : {}) },
      func: captureSelectionInPage,
    });
    const captured = injection?.result as { selection: string; block: string } | undefined;
    if (!captured) return "";
    return extractSentence(captured.block, captured.selection || selectionText);
  } catch {
    return "";
  }
}
