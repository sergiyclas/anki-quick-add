// Composes the YouTube channel art and the video thumbnail:
//   youtube/banner.png      2560x1440  (safe area for all devices: centred 1546x423)
//   youtube/avatar.png       800x800   (cropped to a circle by YouTube)
//   youtube/watermark.png    150x150   (transparent, shown in the player corner)
//   youtube/thumbnail.png   1280x720   (custom thumbnail for the feature-tour video)
// Usage: node scripts/youtube-assets.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "youtube");
const RAW = resolve(ROOT, "video", "raw");
const MARK = readFileSync(resolve(ROOT, "art", "channel-mark.svg"), "utf8");
const APP_ICON = readFileSync(resolve(ROOT, "art", "icon.svg"), "utf8");
if (!existsSync(OUT)) mkdirSync(OUT);

const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
const dataUri = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
const sized = (svg, px) => svg.replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`);

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; overflow: hidden; color: #f5f7ff; font-family: "Segoe UI", system-ui, sans-serif; }
.bg { position: absolute; inset: 0;
  background: radial-gradient(1400px 900px at 18% 12%, #24408a 0%, transparent 62%),
    radial-gradient(1100px 800px at 88% 88%, #3a2a66 0%, transparent 58%), linear-gradient(135deg, #0e1734, #1a2a5c); }
.accent { color: #ff7a59; }
.muted { color: #b9c3e6; }
`;

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(name, width, height, body, { transparent = false } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}body{width:${width}px;height:${height}px;position:relative}</style></head><body>${body}</body></html>`,
  );
  await page.waitForTimeout(250);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width, height }, omitBackground: transparent });
  writeFileSync(resolve(OUT, `${name}.png`), png);
  console.log(`${name}.png  ${width}x${height}`);
}

// --- Banner: everything that must survive the phone crop lives in the centred 1546x423 box ---------
await render(
  "banner",
  2560,
  1440,
  `<div class="bg"></div>
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:1546px;height:423px;
    display:flex;align-items:center;justify-content:center;gap:56px;padding:0 40px">
    ${sized(MARK, 208)}
    <div>
      <div style="font-size:74px;font-weight:700;letter-spacing:-.02em;line-height:1.05">Usable <span class="accent">Extensions</span></div>
      <div class="muted" style="font-size:31px;margin-top:18px">Small browser extensions that do one thing well</div>
      <div style="display:flex;gap:14px;margin-top:26px;font-size:21px;color:#cfd8f5">
        ${["real screen captures", "open source", "no accounts, no tracking"]
          .map((t) => `<span style="padding:9px 20px;border:1px solid rgba(255,255,255,.22);border-radius:999px">${t}</span>`)
          .join("")}
      </div>
    </div>
  </div>`,
);

// --- Avatar: YouTube crops to a circle, so keep the mark well inside ------------------------------
await render(
  "avatar",
  800,
  800,
  `<div class="bg"></div>
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${sized(MARK, 560)}</div>`,
);

// --- Watermark: transparent, sits in the player corner -------------------------------------------
await render("watermark", 150, 150, `<div style="position:absolute;inset:0">${sized(MARK, 150)}</div>`, { transparent: true });

// --- Video thumbnail: the real card from the capture, big claim, readable at 210px wide ------------
const card = readFileSync(resolve(RAW, "card-02-back.png"));
const { w: cw } = pngSize(card);
const CARD_CONTENT_H = 1360; // the capture has empty page below the card
const boxW = 470;
const scale = boxW / cw;
const boxH = Math.round(CARD_CONTENT_H * scale);
await render(
  "thumbnail",
  1280,
  720,
  `<div class="bg"></div>
  <div style="position:absolute;left:60px;top:50%;transform:translateY(-50%);width:660px">
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:26px">
      ${sized(APP_ICON, 76)}
      <div style="font-size:30px;font-weight:600;letter-spacing:.01em">Anki Quick Add</div>
    </div>
    <div style="font-size:78px;font-weight:800;line-height:1.03;letter-spacing:-.02em">One word in.<br><span class="accent">A complete<br>Anki card out.</span></div>
    <div class="muted" style="font-size:29px;margin-top:28px">Chrome extension · no API key needed</div>
  </div>
  <div style="position:absolute;right:70px;top:50%;transform:translateY(-50%);width:${boxW}px;height:${boxH}px;
    border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 30px 70px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.14)">
    <img src="${dataUri(card)}" style="position:absolute;left:0;top:0;width:${boxW}px">
  </div>`,
);

await browser.close();
