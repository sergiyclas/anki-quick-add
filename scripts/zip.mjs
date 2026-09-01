// Packs dist/ into a Chrome Web Store upload: anki-quick-add-<version>.zip (manifest.json at the zip root).
// Usage: npm run build && npm run zip
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
if (!existsSync(resolve(dist, "manifest.json"))) {
  console.error("dist/manifest.json not found - run `npm run build` first");
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(resolve(dist, "manifest.json"), "utf8"));
const out = resolve(root, `anki-quick-add-${version}.zip`);
rmSync(out, { force: true });

if (process.platform === "win32") {
  execFileSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path '${dist}\\*' -DestinationPath '${out}'`], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-r", "-q", out, "."], { cwd: dist, stdio: "inherit" });
}
console.log(`written ${out}`);
