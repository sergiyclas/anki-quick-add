// Post-build sanity checks for dist/.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve(import.meta.dirname, "..", "dist");
const problems = [];

// Content scripts run as classic scripts: an ES-module import would throw on every page.
const content = readFileSync(resolve(dist, "content.js"), "utf8");
if (/^\s*(import|export)\s|\bimport\(/m.test(content)) problems.push("dist/content.js contains import/export statements - keep src/content self-contained");
// Top-level let/const would throw "already declared" when the script is injected twice into one frame.
if (/^\s*(let|const|class)\s/m.test(content)) problems.push("dist/content.js has top-level declarations - keep the code inside the IIFE");

for (const file of ["manifest.json", "background.js", "popup/index.html", "options/index.html", "editor/index.html", "_locales/en/messages.json", "_locales/uk/messages.json"]) {
  if (!existsSync(resolve(dist, file))) problems.push(`missing dist/${file}`);
}

const manifest = JSON.parse(readFileSync(resolve(dist, "manifest.json"), "utf8"));
const en = JSON.parse(readFileSync(resolve(dist, "_locales/en/messages.json"), "utf8"));
const missing = [];
const placeholders = (s) => [...s.matchAll(/\$[A-Z]+\$/g)].map((m) => m[0]).sort().join(",");
for (const dir of readdirSync(resolve(dist, "_locales"))) {
  if (dir === "en") continue;
  const loc = JSON.parse(readFileSync(resolve(dist, "_locales", dir, "messages.json"), "utf8"));
  for (const key of Object.keys(en)) {
    if (!(key in loc)) missing.push(`${dir}:${key}`);
    else if (placeholders(loc[key].message) !== placeholders(en[key].message)) problems.push(`${dir} locale: placeholders differ in "${key}"`);
  }
  for (const key of Object.keys(loc)) if (!(key in en)) problems.push(`${dir} locale has unknown key "${key}"`);
}
for (const ref of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) if (!(ref[1] in en)) problems.push(`manifest references unknown message "${ref[1]}"`);

if (missing.length) console.warn(`verify-dist: ${missing.length} message(s) fall back to English: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? ", …" : ""}`);
if (problems.length) {
  console.error(problems.map((p) => `verify-dist: ${p}`).join("\n"));
  process.exit(1);
}
console.log("verify-dist: ok");
