// Composes the Chrome Web Store listing images from the real captures in video/raw:
//   store/screenshot-N.png   1280x800  (five feature shots with captions)
//   store/promo-small.png     440x280  (small promo tile)
//   store/promo-marquee.png  1400x560  (marquee promo tile)
// Usage: npx tsx scripts/capture.ts  (once)  ->  node scripts/store-assets.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const RAW = resolve(ROOT, "video", "raw");
const STORE = resolve(ROOT, "store");
const ICON = readFileSync(resolve(ROOT, "art", "icon.svg"), "utf8");

const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
const dataUri = (buf) => `data:image/png;base64,${buf.toString("base64")}`;

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; overflow: hidden; color: #f5f7ff; font-family: "Segoe UI", system-ui, sans-serif;
  background: radial-gradient(900px 600px at 15% 10%, #24408a 0%, transparent 60%),
    radial-gradient(700px 500px at 90% 90%, #3a2a66 0%, transparent 55%), linear-gradient(135deg, #0e1734, #1a2a5c); }
.eyebrow { font-size: 15px; letter-spacing: .16em; text-transform: uppercase; color: #7ea6ff; font-weight: 600; margin-bottom: 12px; }
h1 { margin: 0 0 16px; font-size: 44px; line-height: 1.08; font-weight: 700; letter-spacing: -.015em; }
ul { list-style: none; padding: 0; margin: 0; font-size: 21px; color: #b9c3e6; }
li { padding: 6px 0 6px 30px; position: relative; }
li::before { content: ""; position: absolute; left: 0; top: 14px; width: 14px; height: 14px; border-radius: 50%; background: #ff7a59; }
.stage { display: grid; grid-template-columns: 430px 1fr; gap: 40px; align-items: center; height: 100%; padding: 50px 60px; }
.window { border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 24px 60px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.12); }
.winbar { height: 32px; background: #e9edf7; display: flex; align-items: center; gap: 6px; padding: 0 12px; color: #56607a; font-size: 14px; }
.winbar span { width: 9px; height: 9px; border-radius: 50%; background: #c9cfdf; }
.winbar em { font-style: normal; margin-left: 8px; }
.viewport { overflow: hidden; position: relative; background: #fff; }
.viewport img { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.accent { color: #ff7a59; }
.hero { height: 100%; display: flex; align-items: center; gap: 28px; padding: 0 40px; }
.hero svg { flex: none; filter: drop-shadow(0 10px 30px rgba(0,0,0,.4)); }
.hero h1 { margin: 0 0 6px; }
.hero p { margin: 0; color: #b9c3e6; }
`;

function windowHtml(image, boxW, boxH, focus, title) {
  const buf = readFileSync(resolve(RAW, image));
  const { w: iw, h: ih } = pngSize(buf);
  const [fx, fy, fw, fh] = focus ?? [0, 0, iw, ih];
  const scale = Math.min(boxW / fw, boxH / fh);
  const offX = (boxW - fw * scale) / 2 - fx * scale;
  const offY = (boxH - fh * scale) / 2 - fy * scale;
  return `<div class="window" style="width:${boxW}px;height:${boxH + 32}px">
    <div class="winbar"><span></span><span></span><span></span><em>${title}</em></div>
    <div class="viewport" style="width:${boxW}px;height:${boxH}px">
      <img src="${dataUri(buf)}" style="width:${(iw * scale).toFixed(1)}px;height:${(ih * scale).toFixed(1)}px;transform:translate(${offX.toFixed(1)}px,${offY.toFixed(1)}px)"></div></div>`;
}

const shots = [
  {
    name: "screenshot-1",
    eyebrow: "Anki Quick Add",
    title: "One word in.<br><span class='accent'>A complete Anki card out.</span>",
    lines: ["translation, IPA, part of speech", "examples, synonyms, grammar notes", "pronunciation audio + Wikipedia image"],
    image: "card-02-back.png",
    box: [560, 620],
    title2: "Anki – the card it made",
  },
  {
    name: "screenshot-2",
    eyebrow: "Popup · Alt+A",
    title: "Type a word, press Enter",
    lines: ["instant translation while you type", "your LLM fills the rest", "added to Anki through AnkiConnect"],
    image: "popup-04-added.png",
    box: [600, 560],
    title2: "Anki Quick Add",
  },
  {
    name: "screenshot-3",
    eyebrow: "Selection bubble · Shift + select",
    title: "The meaning this sentence means",
    lines: ["\"bat\" here is the one you swing", "the usual meaning stays underneath", "one click adds the card"],
    image: "bubble-01-translation.png",
    box: [700, 560],
    focus: [480, 380, 1360, 900],
    title2: "en.wikipedia.org/wiki/Baseball",
  },
  {
    name: "screenshot-4",
    eyebrow: "Offline queue",
    title: "Anki can stay closed",
    lines: ["the card is built right away", "it waits with its audio and image", "written the moment Anki is back"],
    image: "queue-01-list.png",
    box: [600, 560],
    title2: "Anki Quick Add",
  },
  {
    name: "screenshot-5",
    eyebrow: "Settings",
    title: "Any provider, any note type",
    lines: ["OpenAI, Google, Anthropic or OpenAI-compatible", "built-in note type or your own fields", "~40 languages, CEFR level, duplicates policy"],
    image: "options-02-anki-mapping.png",
    box: [700, 620],
    focus: [0, 0, 1800, 1600],
    title2: "Settings – Anki",
  },
];

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(name, width, height, body) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}body{width:${width}px;height:${height}px}</style></head><body>${body}</body></html>`);
  await page.waitForTimeout(300);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width, height } });
  writeFileSync(resolve(STORE, `${name}.png`), png);
  console.log(`${name}.png  ${width}x${height}`);
}

for (const s of shots) {
  await render(
    s.name,
    1280,
    800,
    `<div class="stage"><div><div class="eyebrow">${s.eyebrow}</div><h1>${s.title}</h1><ul>${s.lines.map((l) => `<li>${l}</li>`).join("")}</ul></div>
     <div>${windowHtml(s.image, s.box[0], s.box[1], s.focus, s.title2)}</div></div>`,
  );
}

await render(
  "promo-small",
  440,
  280,
  `<div class="hero" style="padding:0 34px">${ICON.replace(/width="\d+" height="\d+"/, 'width="96" height="96"')}
   <div><h1 style="font-size:34px">Anki Quick Add</h1><p style="font-size:17px">One word in.<br>A complete Anki card out.</p></div></div>`,
);

await render(
  "promo-marquee",
  1400,
  560,
  `<div class="hero" style="padding:0 90px;gap:60px">${ICON.replace(/width="\d+" height="\d+"/, 'width="220" height="220"')}
   <div><h1 style="font-size:78px;margin-bottom:14px">Anki Quick Add</h1>
   <p style="font-size:34px;line-height:1.35">Type or select a word – get a complete Anki card:<br>translation, IPA, examples, audio and image, from the LLM you choose.</p></div></div>`,
);

await browser.close();
