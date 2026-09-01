// Loads dist/ into a headless Chromium as an unpacked extension and exercises the popup and options pages.
// Requires a prior `npm run build`. Anki with AnkiConnect should be running for the deck checks.
// Optional env: AQA_API_KEY (Anthropic) to run a real add; AQA_WORD (default "queue"); AQA_DECK; AQA_NOTE_TYPE.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";

const DIST = resolve(import.meta.dirname, "..", "dist");
const EXT_ID = "cloiddhjganefpijbpjkonahgmlfjlpm";
const url = (path) => `chrome-extension://${EXT_ID}/${path}`;

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
};

const context = await chromium.launchPersistentContext(mkdtempSync(resolve(tmpdir(), "aqa-e2e-")), {
  channel: "chromium",
  headless: true,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

const pageErrors = [];
context.on("page", (page) => {
  page.on("pageerror", (e) => pageErrors.push(`${page.url()}: ${e.message}`));
  page.on("console", (msg) => msg.type() === "error" && pageErrors.push(`${page.url()}: ${msg.text()}`));
});

let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent("serviceworker");
check(worker.url() === url("background.js"), `service worker started: ${worker.url()}`);

// Seed settings so the run does not depend on what is stored in this throwaway profile.
await worker.evaluate(
  async ({ apiKey, deck, noteType }) => {
    await chrome.storage.sync.set({
      settings: { anki: { deck, modelName: noteType, tags: ["quick-add", "e2e"] } },
      keys: apiKey ? { anthropic: apiKey } : {},
    });
  },
  { apiKey: process.env.AQA_API_KEY ?? "", deck: process.env.AQA_DECK ?? "Default", noteType: process.env.AQA_NOTE_TYPE ?? "My cards_en-uk" },
);

// Popup: renders, pings the worker, shows Anki status.
const popup = await context.newPage();
await popup.goto(url("popup/index.html"));
await popup.waitForSelector(".popup-footer span");
const footer = await popup.textContent(".popup-footer span");
check(footer && footer !== "…", `popup footer: ${footer}`);
check(!footer.includes("offline"), "popup reports Anki connected");

// Options: tabs render, Anki tab lists decks and note types through the worker.
const options = await context.newPage();
await options.goto(url("options/index.html"));
await options.waitForSelector("nav.tabs button");
check((await options.$$("nav.tabs button")).length === 5, "options has 5 tabs");
await options.click("nav.tabs button:nth-child(2)");
// The selects show the saved value immediately; wait for the lists fetched through the worker.
await options.waitForSelector('select >> nth=1 >> option[value="Basic"]', { state: "attached", timeout: 10_000 });
const decks = await options.$$eval("select >> nth=0 >> option", (opts) => opts.map((o) => o.value));
const models = await options.$$eval("select >> nth=1 >> option", (opts) => opts.map((o) => o.value));
check(decks.length > 0, `decks listed via AnkiConnect: ${decks.join(", ")}`);
check(models.includes("Basic"), `note types listed: ${models.length} (includes Basic)`);

// Field mapping table appears for the configured note type (legacy v1 layout auto-detected).
await options.waitForSelector(".mapping table tr", { timeout: 10_000 });
const mappedWord = await options.$eval(".mapping table tr:first-child select", (s) => s.value);
check(mappedWord === "En", `mapping auto-detected for My cards_en-uk: word -> ${mappedWord}`);

// Preview tab renders the note type's real templates with sample data inside a sandboxed iframe.
await options.click("nav.tabs button:nth-child(4)");
await options.waitForSelector("iframe.preview-frame", { timeout: 10_000 });
const previewHtml = await options.$eval("iframe.preview-frame", (f) => f.getAttribute("srcdoc") ?? "");
check(previewHtml.includes("queue") && previewHtml.includes("черга"), "preview shows sample word and translation");
check(previewHtml.includes("<style>"), "preview embeds the note type CSS");

// Backup tab renders and shows granted hosts.
await options.click("nav.tabs button:nth-child(5)");
await options.waitForSelector('input[type="file"]');
check(true, "backup tab renders");

// Add flow: without a key the pipeline must stop at the config step with a clear message.
const word = process.env.AQA_WORD ?? "queue";
await popup.fill(".popup-input", word);
await popup.press(".popup-input", "Enter");
await popup.waitForFunction(() => {
  const s = document.querySelector(".popup-status");
  return s && s.textContent && !s.textContent.startsWith("Adding");
}, null, { timeout: 120_000 });
const status = await popup.textContent(".popup-status");
if (process.env.AQA_API_KEY) {
  check(/^Added:|^Already in collection/.test(status), `add result: ${status}`);
} else {
  check(status.includes("API key is not set"), `add without key stops at config: ${status}`);
}

// Batch mode: two words without a key -> two errors, state survives in session storage, summary rendered.
if (!process.env.AQA_API_KEY) {
  await popup.click(".popup-modes a:nth-child(2)");
  await popup.fill(".batch textarea", "alpha\nbeta");
  await popup.click(".batch button");
  await popup.waitForSelector(".batch-list li.error", { timeout: 30_000 });
  await popup.waitForFunction(() => document.querySelectorAll(".batch-list li.error").length === 2, null, { timeout: 30_000 });
  await popup.waitForSelector(".batch .row span.ok", { timeout: 10_000 });
  const batchSummary = await popup.textContent(".batch .row span.ok");
  check(/2/.test(batchSummary ?? ""), `batch summary after two failures: ${batchSummary}`);
  const state = await worker.evaluate(async () => (await chrome.storage.session.get("batch:current"))["batch:current"]);
  check(state && state.running === false && state.items.length === 2, "batch state persisted in session storage");
}

// Instant translation preview in the popup (free Google endpoint, no LLM).
await popup.click(".popup-modes a:nth-child(1)");
await popup.fill(".popup-input", "queue");
await popup.waitForSelector(".popup-preview", { timeout: 15_000 });
const preview = await popup.textContent(".popup-preview");
check(Boolean(preview && /черг/i.test(preview)), `popup instant translation: ${preview}`);
await popup.fill(".popup-input", "");

// Selection bubble: inject content.js into a page we already have host permission for, select a word, expect the bubble.
const wiki = await context.newPage();
await wiki.goto("https://en.wikipedia.org/wiki/Queue_(abstract_data_type)", { waitUntil: "domcontentloaded" });
const wikiTabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: "https://en.wikipedia.org/*" }))[0]?.id);
await worker.evaluate((tabId) => chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }), wikiTabId);
await wiki.evaluate(() => {
  const p = [...document.querySelectorAll("#mw-content-text p")].find((el) => /queue/i.test(el.textContent ?? ""));
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const i = node.textContent.toLowerCase().indexOf("queue");
    if (i >= 0) {
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 5);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      break;
    }
  }
  // Default trigger is "while holding Shift".
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, shiftKey: true }));
});
await wiki.waitForSelector("#aqa-bubble-host", { state: "attached", timeout: 10_000 });
await wiki.waitForFunction(() => {
  const tr = document.querySelector("#aqa-bubble-host")?.shadowRoot?.querySelector(".tr");
  return tr && tr.textContent && tr.textContent !== "…";
}, null, { timeout: 15_000 });
const bubbleTr = await wiki.evaluate(() => document.querySelector("#aqa-bubble-host").shadowRoot.querySelector(".tr").textContent);
check(/черг/i.test(bubbleTr), `bubble instant translation: ${bubbleTr}`);
if (!process.env.AQA_API_KEY) {
  await wiki.evaluate(() => document.querySelector("#aqa-bubble-host").shadowRoot.querySelector("button.add").click());
  await wiki.waitForFunction(() => /API key/.test(document.querySelector("#aqa-bubble-host")?.shadowRoot?.querySelector(".status")?.textContent ?? ""), null, { timeout: 15_000 });
  check(true, "bubble add without key reports the config error inline");
}

// Editor page without a job shows a clear message instead of crashing.
const editor = await context.newPage();
await editor.goto(url("editor/index.html"));
await editor.waitForSelector("p.err");
check(true, "editor page renders its empty state");

check(pageErrors.length === 0, `no page errors${pageErrors.length ? ":\n  " + pageErrors.join("\n  ") : ""}`);

await context.close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
