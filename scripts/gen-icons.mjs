// Renders art/icon.svg (48, 128) and art/icon-small.svg (16, 32) to public/icons/*.png with headless Chromium,
// plus the Chrome Web Store icon (128 px canvas, 96 px artwork, transparent padding) to store/icon128.png.
// Usage: node scripts/gen-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const art = (name) => readFileSync(resolve(root, "art", name), "utf8");
const targets = [
  { size: 16, svg: "icon-small.svg", out: "public/icons/icon16.png" },
  { size: 32, svg: "icon-small.svg", out: "public/icons/icon32.png" },
  { size: 48, svg: "icon.svg", out: "public/icons/icon48.png" },
  { size: 128, svg: "icon.svg", out: "public/icons/icon128.png" },
  { size: 128, svg: "icon.svg", out: "store/icon128.png", artwork: 96 },
];

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { size, svg, out, artwork = size } of targets) {
  const offset = (size - artwork) / 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:transparent"><div style="position:absolute;left:${offset}px;top:${offset}px;width:${artwork}px;height:${artwork}px">` +
      art(svg).replace(/width="\d+" height="\d+"/, `width="${artwork}" height="${artwork}"`) +
      `</div></body>`,
  );
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  mkdirSync(resolve(root, out, ".."), { recursive: true });
  writeFileSync(resolve(root, out), png);
  console.log(`${out}  ${size}px`);
}
await browser.close();
