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
      settings: { provider: "anthropic", anki: { deck, modelName: noteType, tags: ["quick-add", "e2e"] } },
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

// General tab: language and theme switches take effect immediately, without Save.
await options.click("nav.tabs button:nth-child(5)");
await options.waitForSelector('input[type="file"]');
check(true, "general tab renders");
const languageSelect = 'select:has(option[value="auto"])';
const themeSelect = 'select:has(option[value="schedule"])';
await options.selectOption(languageSelect, "de");
await options.waitForFunction(() => document.querySelector("nav.tabs button")?.textContent === "Anbieter");
check(true, "interface language override re-renders the options page in German");
await options.selectOption(themeSelect, "dark");
await options.waitForFunction(() => document.documentElement.dataset.theme === "dark");
check(true, "interface theme forced to dark");
await options.selectOption(languageSelect, "auto");
await options.waitForFunction(() => document.querySelector("nav.tabs button")?.textContent !== "Anbieter");
await options.selectOption(themeSelect, "system");
await options.waitForFunction(() => document.documentElement.dataset.theme === undefined);

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

// Free provider: a real add with no API key (Google dictionary data + dictionaryapi + Tatoeba), then clean up.
{
  await worker.evaluate(async () => {
    const { settings } = await chrome.storage.sync.get("settings");
    await chrome.storage.sync.set({ settings: { ...settings, provider: "free", anki: { ...settings.anki, modelName: "Anki Quick Add" } } });
  });
  await popup.reload();
  await popup.waitForFunction(() => document.querySelector(".popup-row select")?.value, null, { timeout: 15_000 });
  await popup.fill(".popup-input", "harbor");
  await popup.press(".popup-input", "Enter");
  await popup.waitForFunction(() => !document.querySelector(".popup-input")?.hasAttribute("disabled") && (document.querySelector(".popup-status")?.textContent ?? "").length > 0, null, { timeout: 120_000 });
  const freeStatus = await popup.textContent(".popup-status");
  check(/^(Added|Додано)/.test(freeStatus ?? ""), `free provider added a card without a key: ${freeStatus}`);
  const anki = async (action, params = {}) => (await (await fetch("http://127.0.0.1:8765", { method: "POST", body: JSON.stringify({ action, version: 6, params }) })).json()).result;
  const ids = await anki("findNotes", { query: '"Word:harbor" tag:aqa' });
  if (ids.length) {
    const [info] = await anki("notesInfo", { notes: ids });
    const fields = Object.fromEntries(Object.entries(info.fields).map(([k, v]) => [k, v.value]));
    check(Boolean(fields.Translation) && Boolean(fields.Examples), `free card has translation "${fields.Translation}" and examples`);
    check(/\[sound:/.test(fields.Audio ?? ""), "free card has pronunciation audio");
    const media = Object.values(fields).flatMap((v) => [...String(v).matchAll(/\[sound:([^\]]+)\]|src="([^"]+)"/g)].map((m) => m[1] ?? m[2]));
    await anki("deleteNotes", { notes: ids });
    for (const name of media) if (name.startsWith("aqa_")) await anki("deleteMediaFile", { filename: name });
  } else {
    check(false, "free card not found in Anki");
  }
  await worker.evaluate(async () => {
    const { settings } = await chrome.storage.sync.get("settings");
    await chrome.storage.sync.set({ settings: { ...settings, provider: "anthropic" } });
  });
  await popup.reload();
  await popup.waitForSelector(".popup-input");
}

// Offline queue: with Anki unreachable the card is still built and parked, and lands once Anki answers.
{
  const anki = async (action, params = {}) =>
    (await (await fetch("http://127.0.0.1:8765", { method: "POST", body: JSON.stringify({ action, version: 6, params }) })).json()).result;
  const setAnkiUrl = (ankiUrl) =>
    worker.evaluate(async (u) => {
      const { settings } = await chrome.storage.sync.get("settings");
      await chrome.storage.sync.set({
        settings: { ...settings, provider: "free", anki: { ...settings.anki, url: u, modelName: "Anki Quick Add" } },
      });
    }, ankiUrl);
  const queueCount = () =>
    worker.evaluate(
      () =>
        new Promise((resolve) => {
          const open = indexedDB.open("aqa-queue", 1);
          open.onsuccess = () => {
            const tx = open.result.transaction("items", "readonly").objectStore("items").count();
            tx.onsuccess = () => resolve(tx.result);
          };
          open.onerror = () => resolve(-1);
        }),
    );

  await setAnkiUrl("http://127.0.0.1:8799"); // nothing listens there
  await popup.reload();
  await popup.waitForFunction(() => document.querySelector(".popup-row select")?.value, null, { timeout: 15_000 });
  await popup.fill(".popup-input", "lantern");
  await popup.press(".popup-input", "Enter");
  await popup.waitForFunction(
    () => !document.querySelector(".popup-input")?.hasAttribute("disabled") && (document.querySelector(".popup-status")?.textContent ?? "").length > 0,
    null,
    { timeout: 120_000 },
  );
  const queuedStatus = await popup.textContent(".popup-status");
  check((await queueCount()) === 1, `card queued while Anki is closed: ${queuedStatus}`);
  await popup.waitForSelector(".popup-queue", { timeout: 5_000 });
  check(true, "popup shows the queue bar after queueing");

  await setAnkiUrl("http://127.0.0.1:8765");
  await popup.click(".popup-queue button");
  await popup.waitForFunction(() => !document.querySelector(".popup-queue"), null, { timeout: 60_000 });
  check((await queueCount()) === 0, "queue emptied through the popup button");

  const ids = await anki("findNotes", { query: '"Word:lantern" tag:aqa' });
  check(ids.length === 1, `queued card reached Anki: ${ids.length} note(s)`);
  if (ids.length) {
    const [info] = await anki("notesInfo", { notes: ids });
    const fields = Object.fromEntries(Object.entries(info.fields).map(([k, v]) => [k, v.value]));
    check(Boolean(fields.Translation), `queued card kept its content: "${fields.Translation}"`);
    check(/\[sound:/.test(fields.Audio ?? ""), "queued card kept its audio through IndexedDB");
    const media = Object.values(fields).flatMap((v) => [...String(v).matchAll(/\[sound:([^\]]+)\]|src="([^"]+)"/g)].map((m) => m[1] ?? m[2]));
    await anki("deleteNotes", { notes: ids });
    for (const name of media) if (name.startsWith("aqa_")) await anki("deleteMediaFile", { filename: name });
  }
  await worker.evaluate(async () => {
    const { settings } = await chrome.storage.sync.get("settings");
    await chrome.storage.sync.set({ settings: { ...settings, provider: "anthropic" } });
  });
  await popup.reload();
  await popup.waitForSelector(".popup-input");
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
