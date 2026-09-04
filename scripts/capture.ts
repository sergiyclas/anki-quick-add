// Drives the built extension in headless Chromium against the real Anki and a real LLM provider, and
// captures every UI state as PNG for the README (docs/) and the promo video (video/raw/).
// Nothing is staged: the cards on screen are whatever the provider generated on this run.
//
// Usage:  npm run build && npx tsx scripts/capture.ts [--keep]
// Env:    GEMINI_API_KEY (required), AQA_GEMINI_MODEL (default gemini-3.5-flash)
// Anki must be running with AnkiConnect. Notes are added to a temporary deck and removed at the end
// unless --keep is given.
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { type BrowserContext, type Page, chromium } from "playwright";
import { BUILTIN_CSS, BUILTIN_TEMPLATES } from "../src/lib/anki/builtinModel";
import { renderTemplate } from "../src/lib/note/mustache";

const DIST = resolve("dist");
const RAW = resolve("video/raw");
const DOCS = resolve("docs");
const EXT_ID = "cloiddhjganefpijbpjkonahgmlfjlpm";
const ANKI = "http://127.0.0.1:8765";
const DECK = "English vocabulary";
const KEY = process.env["GEMINI_API_KEY"];
const MODEL = process.env["AQA_GEMINI_MODEL"] ?? "gemini-3.5-flash";
const KEEP = process.argv.includes("--keep");
if (!KEY) throw new Error("GEMINI_API_KEY is not set");

const url = (path: string) => `chrome-extension://${EXT_ID}/${path}`;
mkdirSync(RAW, { recursive: true });
mkdirSync(DOCS, { recursive: true });

async function anki<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ANKI, { method: "POST", body: JSON.stringify({ action, version: 6, params }) });
  const json = (await res.json()) as { result: T; error: string | null };
  if (json.error) throw new Error(`AnkiConnect ${action}: ${json.error}`);
  return json.result;
}

async function shot(page: Page, name: string, opts: { fullPage?: boolean; docs?: string } = {}): Promise<void> {
  const file = resolve(RAW, `${name}.png`);
  await page.screenshot({ path: file, fullPage: opts.fullPage ?? false });
  if (opts.docs) await page.screenshot({ path: resolve(DOCS, `${opts.docs}.png`), fullPage: opts.fullPage ?? false });
  console.log(`captured ${name}`);
}

// Language-independent: the input is disabled while a word is being added.
const waitForIdleStatus = (page: Page) =>
  page.waitForFunction(
    () => !document.querySelector(".popup-input")?.hasAttribute("disabled") && (document.querySelector(".popup-status")?.textContent ?? "").length > 0,
    null,
    { timeout: 120_000 },
  );

async function cleanup(deckExisted: boolean): Promise<void> {
  const created = await anki<number[]>("findNotes", { query: `"deck:${DECK}" tag:aqa` });
  console.log(`notes created this run: ${created.length}`);
  if (KEEP) return;
  if (created.length) {
    const infos = await anki<{ fields: Record<string, { value: string }> }[]>("notesInfo", { notes: created });
    const media = new Set<string>();
    for (const info of infos) {
      for (const f of Object.values(info.fields)) {
        for (const m of f.value.matchAll(/\[sound:([^\]]+)\]|src="([^"]+)"/g)) media.add(m[1] ?? m[2]!);
      }
    }
    await anki("deleteNotes", { notes: created });
    for (const name of media) if (name.startsWith("aqa_")) await anki("deleteMediaFile", { filename: name });
  }
  if (!deckExisted) await anki("deleteDecks", { decks: [DECK], cardsToo: true });
  console.log("cleanup done (use --keep to leave the notes in Anki)");
}

async function main(): Promise<void> {
  const decksBefore = await anki<string[]>("deckNames");
  const deckExisted = decksBefore.includes(DECK);
  if (!deckExisted) await anki("createDeck", { deck: DECK });
  try {
    await capture();
  } finally {
    await cleanup(deckExisted);
  }
}

async function capture(): Promise<void> {

  const context: BrowserContext = await chromium.launchPersistentContext(mkdtempSync(resolve(tmpdir(), "aqa-capture-")), {
    channel: "chromium",
    headless: true,
    locale: "en-US",
    colorScheme: "light",
    deviceScaleFactor: 2,
    // chrome.i18n follows the browser UI language, which only --lang controls (the `locale` option does not).
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, "--lang=en-US"],
  });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");

  await worker.evaluate(
    async ({ key, model, deck }) => {
      await chrome.storage.sync.set({
        settings: {
          provider: "gemini",
          providers: { gemini: { model, effort: "low" } },
          languages: { source: "en", target: "uk" },
          anki: { deck, modelName: "Anki Quick Add", tags: ["quick-add"] },
          ui: { selectionBubble: true, bubbleTrigger: "always", quickTranslate: true },
        },
        keys: { gemini: key },
      });
    },
    { key: KEY, model: MODEL, deck: DECK },
  );

  // --- Popup: empty -> typing (instant translation) -> adding -> added --------------------------
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 340, height: 300 });
  await popup.goto(url("popup/index.html"));
  await popup.waitForSelector(".popup-footer span:not(:empty)");
  await popup.waitForFunction(() => !(document.querySelector(".popup-footer span")?.textContent ?? "").includes("…"));
  await shot(popup, "popup-01-empty", { fullPage: true });

  await popup.type(".popup-input", "lighthouse", { delay: 40 });
  await popup.waitForSelector(".popup-preview", { timeout: 15_000 });
  await shot(popup, "popup-02-typing", { fullPage: true });

  await popup.press(".popup-input", "Enter");
  await popup.waitForSelector(".popup-input[disabled]");
  await shot(popup, "popup-03-adding", { fullPage: true });
  await waitForIdleStatus(popup);
  await shot(popup, "popup-04-added", { fullPage: true, docs: "01-popup-added" });
  const status1 = await popup.textContent(".popup-status");
  console.log(`  status: ${status1}`);

  await popup.type(".popup-input", "harbor", { delay: 40 });
  await popup.press(".popup-input", "Enter");
  await waitForIdleStatus(popup);
  await shot(popup, "popup-05-added-two", { fullPage: true });

  // --- The resulting card, rendered with the built-in note type's real templates and CSS -------
  const ids = await anki<number[]>("findNotes", { query: `"deck:${DECK}" "Word:lighthouse"` });
  if (ids.length) {
    const [info] = await anki<{ fields: Record<string, { value: string }> }[]>("notesInfo", { notes: ids });
    const fields = Object.fromEntries(Object.entries(info!.fields).map(([k, v]) => [k, v.value]));
    const imgName = /src="([^"]+)"/.exec(fields["Image"] ?? "")?.[1];
    if (imgName) {
      const b64 = await anki<string>("retrieveMediaFile", { filename: imgName });
      const mime = imgName.endsWith(".png") ? "image/png" : "image/jpeg";
      fields["Image"] = fields["Image"]!.replace(imgName, `data:${mime};base64,${b64}`);
    }
    const ctx = { fields, card: "Recognition", deck: DECK, type: "Anki Quick Add", tags: ["quick-add"] };
    const front = renderTemplate(BUILTIN_TEMPLATES[0]!.Front, ctx);
    const back = renderTemplate(BUILTIN_TEMPLATES[0]!.Back, { ...ctx, frontSide: front });
    const cardPage = await context.newPage();
    await cardPage.setViewportSize({ width: 640, height: 720 });
    for (const [name, html] of [
      ["card-01-front", front],
      ["card-02-back", back],
    ] as const) {
      await cardPage.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${BUILTIN_CSS}</style><style>html,body{margin:0;height:100%}</style></head><body class="card">${html}</body></html>`,
      );
      await cardPage.waitForTimeout(300);
      await shot(cardPage, name, { fullPage: true, docs: name === "card-02-back" ? "02-card-back" : undefined });
    }
    await cardPage.close();
  }

  // --- Selection bubble on a real page ----------------------------------------------------------
  const wiki = await context.newPage();
  await wiki.setViewportSize({ width: 1280, height: 800 });
  await wiki.goto("https://en.wikipedia.org/wiki/Baseball", { waitUntil: "domcontentloaded" });
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: "https://en.wikipedia.org/*" }))[0]?.id);
  await worker.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id! }, files: ["content.js"] }), tabId);
  await wiki.evaluate(() => {
    const paragraphs = [...document.querySelectorAll<HTMLElement>("#mw-content-text p")];
    const p = paragraphs.find((el) => /\bbat\b/.test(el.textContent ?? "") && el.getBoundingClientRect().height > 0)!;
    p.scrollIntoView({ block: "center" });
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const m = /\bbat\b/.exec(node.textContent ?? "");
      if (m) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + 3);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
        break;
      }
    }
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, shiftKey: true }));
  });
  await wiki.waitForSelector("#aqa-bubble-host", { state: "attached", timeout: 10_000 });
  await wiki.waitForFunction(() => {
    const tr = document.querySelector("#aqa-bubble-host")?.shadowRoot?.querySelector(".tr");
    return tr && tr.textContent && tr.textContent !== "…";
  }, null, { timeout: 15_000 });
  // The contextual sense arrives a moment after the first line; it is the point of this shot.
  await wiki
    .waitForFunction(() => Boolean(document.querySelector("#aqa-bubble-host")?.shadowRoot?.querySelector(".tr2")?.textContent), null, { timeout: 15_000 })
    .catch(() => undefined);
  await shot(wiki, "bubble-01-translation", { docs: "03-bubble" });
  await wiki.evaluate(() => (document.querySelector("#aqa-bubble-host")!.shadowRoot!.querySelector("button.add") as HTMLButtonElement).click());
  await wiki.waitForFunction(() => Boolean(document.querySelector("#aqa-bubble-host")?.shadowRoot?.querySelector(".status.ok, .status.warn, .status.err")), null, { timeout: 120_000 });
  await shot(wiki, "bubble-02-added");

  // --- Editor window --------------------------------------------------------------------------
  const editorPromise = context.waitForEvent("page", { predicate: (p) => p.url().includes("editor/index.html") });
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: "editor.open", word: "serendipity" }));
  const editor = await editorPromise;
  await editor.setViewportSize({ width: 600, height: 760 });
  await editor.waitForSelector(".editor textarea", { timeout: 120_000 });
  await editor.waitForTimeout(500);
  await shot(editor, "editor-01-ready", { fullPage: true, docs: "04-editor" });

  // --- Options tabs ---------------------------------------------------------------------------
  const options = await context.newPage();
  await options.setViewportSize({ width: 900, height: 980 });
  await options.goto(url("options/index.html"));
  await options.waitForSelector("nav.tabs button");
  await options.waitForTimeout(600);
  await shot(options, "options-01-providers", { fullPage: true, docs: "05-options-providers" });
  await options.click("nav.tabs button:nth-child(2)");
  await options.waitForSelector(".mapping table tr", { timeout: 15_000 });
  await options.waitForTimeout(400);
  await shot(options, "options-02-anki-mapping", { fullPage: true, docs: "06-options-mapping" });
  await options.click("nav.tabs button:nth-child(3)");
  await options.waitForTimeout(300);
  await shot(options, "options-03-generation", { fullPage: true, docs: "07-options-generation" });
  await options.click("nav.tabs button:nth-child(4)");
  await options.waitForSelector("iframe.preview-frame", { timeout: 15_000 });
  await options.waitForTimeout(600);
  await shot(options, "options-04-preview", { fullPage: true, docs: "08-options-preview" });
  await options.click("nav.tabs button:nth-child(5)");
  await options.waitForSelector('input[type="file"]');
  const themeSelect = 'select:has(option[value="schedule"])';
  await options.selectOption(themeSelect, "schedule");
  await options.waitForSelector('input[type="time"]');
  await options.waitForTimeout(300);
  await shot(options, "options-05-general", { fullPage: true, docs: "10-options-general" });
  await options.selectOption(themeSelect, "dark");
  await options.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await options.waitForTimeout(300);
  await shot(options, "options-06-general-dark", { fullPage: true });
  // back to the light theme so the popup shots below stay consistent
  await options.selectOption(themeSelect, "system");
  await options.waitForFunction(() => document.documentElement.dataset.theme === undefined);

  // --- Batch mode ----------------------------------------------------------------------------
  await popup.click(".popup-modes a:nth-child(2)");
  await popup.fill(".batch textarea", "meadow\nglacier\norchard\ncanyon");
  await shot(popup, "batch-01-list", { fullPage: true });
  await popup.click(".batch button");
  await popup.waitForFunction(() => document.querySelectorAll(".batch-list li.added, .batch-list li.updated").length >= 1, null, { timeout: 120_000 });
  await popup.waitForTimeout(200);
  await shot(popup, "batch-02-running", { fullPage: true });
  await popup.waitForSelector(".batch .row span.ok", { timeout: 300_000 });
  await shot(popup, "batch-03-done", { fullPage: true, docs: "09-batch" });

  // --- Offline queue: point Anki at a dead port, park a few cards, show the queue view ------------
  await popup.click(".popup-modes a:nth-child(1)");
  await worker.evaluate(async () => {
    const { settings } = await chrome.storage.sync.get("settings");
    await chrome.storage.sync.set({ settings: { ...settings, provider: "free", anki: { ...settings.anki, url: "http://127.0.0.1:8799" } } });
  });
  await popup.reload();
  await popup.waitForFunction(() => document.querySelector(".popup-row select")?.value, null, { timeout: 15_000 });
  for (const queuedWord of ["lantern", "harbor", "meadow"]) {
    await popup.fill(".popup-input", queuedWord);
    await popup.press(".popup-input", "Enter");
    await popup.waitForFunction(
      () => !document.querySelector(".popup-input")?.hasAttribute("disabled") && (document.querySelector(".popup-status")?.textContent ?? "").length > 0,
      null,
      { timeout: 120_000 },
    );
  }
  await popup.click(".popup-modes a:nth-child(3)");
  await popup.waitForSelector(".queue-list li");
  await popup.waitForTimeout(400);
  await shot(popup, "queue-01-list", { fullPage: true, docs: "11-queue" });
  // The queue lives in this throwaway profile, so nothing needs cleaning up in Anki.

  await context.close();
  writeFileSync(resolve(RAW, "run.json"), JSON.stringify({ model: MODEL, deck: DECK, at: new Date().toISOString() }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
