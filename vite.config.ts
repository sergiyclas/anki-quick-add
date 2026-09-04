import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = resolve(import.meta.dirname, "src");

export default defineConfig({
  root,
  publicDir: resolve(import.meta.dirname, "public"),
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    target: "chrome128",
    modulePreload: false,
    rolldownOptions: {
      input: {
        popup: resolve(root, "popup/index.html"),
        options: resolve(root, "options/index.html"),
        editor: resolve(root, "editor/index.html"),
        background: resolve(root, "background/index.ts"),
        content: resolve(root, "content/index.ts"),
        offscreen: resolve(root, "offscreen/index.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
