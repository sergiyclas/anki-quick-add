// Runs every case in tests/fixtures/sense-cases.json through the built extension and prints what the
// bubble would show. Read the output to score it: "unchanged" is often the right answer, because the
// plain translation already fits the sentence, so no regex can decide this for you.
//
// Google's endpoint refuses further calls after a few hundred in quick succession (and stays cross for
// ~20 minutes), which is why this paces itself. A full run takes about 10 minutes.
//
//   npm run build && node scripts/sense-eval.mjs tests/fixtures/sense-cases.json out.json [from] [to]
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";

const ALL = JSON.parse(readFileSync(process.argv[2], "utf8"));
const CASES = ALL.slice(Number(process.argv[4] ?? 0), Number(process.argv[5] ?? 999)).map((c) => (Array.isArray(c) ? c : [c.word, c.sentence, c.expect]));
const DIST = resolve("dist");
const ctx = await chromium.launchPersistentContext(mkdtempSync(resolve(tmpdir(), "eval-")), {
  channel: "chromium", headless: true, args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const page = await ctx.newPage();
await page.goto("chrome-extension://cloiddhjganefpijbpjkonahgmlfjlpm/options/index.html");
await page.waitForSelector("nav.tabs button");
const sleep = (ms) => page.waitForTimeout(ms);

const rows = [];
let index = 0;
for (const [word, sentence, expect] of CASES) {
  let r = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    r = await page.evaluate(([text, block]) => chrome.runtime.sendMessage({ type: "translate.sense", text, block }), [word, sentence]);
    if (r?.ok && r.base) break;
    await sleep(6000 * (attempt + 1));
  }
  rows.push({ word, sentence, expect, base: r?.base ?? "", contextual: r?.contextual ?? "", confidence: r?.confidence ?? "", form: r?.form ?? "" });
  console.log(`${String(++index).padStart(3)} ${word.padEnd(11)} ${String(r?.base ?? "ERR").padEnd(18)} -> ${String(r?.contextual || "=").padEnd(22)} ${r?.confidence ?? ""}`);
  await sleep(3000);
  if (index % 10 === 0) await sleep(15000);
}
writeFileSync(process.argv[3], JSON.stringify(rows, null, 1));
console.log(`\ncollected ${rows.length}, errors ${rows.filter((r) => !r.base).length}`);
await ctx.close();
