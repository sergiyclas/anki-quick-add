// Packs dist/ into a Chrome Web Store upload: anki-quick-add-<version>.zip (manifest.json at the zip root).
// The store rejects a new item whose manifest carries a "key" (it issues its own key and ID), so the package
// is built from a copy of dist/ with that field removed; dist/ itself keeps it for a stable local ID.
// Usage: npm run build && npm run zip
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
if (!existsSync(resolve(dist, "manifest.json"))) {
  console.error("dist/manifest.json not found - run `npm run build` first");
  process.exit(1);
}

const stage = mkdtempSync(resolve(tmpdir(), "aqa-zip-"));
cpSync(dist, stage, { recursive: true });
const manifest = JSON.parse(readFileSync(resolve(stage, "manifest.json"), "utf8"));
delete manifest.key;
writeFileSync(resolve(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const out = resolve(root, `anki-quick-add-${manifest.version}.zip`);
rmSync(out, { force: true });
if (process.platform === "win32") {
  execFileSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path '${stage}\\*' -DestinationPath '${out}'`], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-r", "-q", out, "."], { cwd: stage, stdio: "inherit" });
}
rmSync(stage, { recursive: true, force: true });
console.log(`written ${out} (manifest "key" stripped for the store)`);
