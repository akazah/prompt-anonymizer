import { resolve } from "node:path";
import { defineConfig } from "vite";

// Two entries: the side panel page (DOM context, runs inference) and the
// MV3 service worker (no DOM; only routes context-menu clicks).
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "sidepanel.html"),
        background: resolve(__dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: "assets/[name].js",
      },
    },
  },
});
