import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the same build works on GitHub Pages subpaths and in Tauri.
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2000,
  },
});
