import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { gistAppConfig } from "./vite.gist.config.ts";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  // Vercel’s Vite preset runs `vite build` with this file. Production must
  // be the gist app (`gist/index.html`), not the local viewer that imports
  // `virtual:diffmap`.
  if (command === "build") return gistAppConfig();

  return {
    // Browser ESM cannot load CJS packages such as Pierre. Vite writes one
    // prebundle into this directory and reuses it until dependencies change.
    cacheDir: path.join(packageRoot, "node_modules/.vite"),
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-dev-runtime",
        "maui",
        "motion/react",
        "purse-styles",
        "@pierre/diffs/react",
        "beautiful-mermaid",
        "elkjs/lib/elk.bundled.js",
        "errore",
      ],
    },
    plugins: [react()],
    resolve: {
      dedupe: ["react", "react-dom", "purse-styles"],
    },
    clearScreen: false,
    server: {
      port: 0,
      strictPort: false,
      // Vite turns this on when it detects a coding agent, and its plugin
      // changes the prebundle hash. Pin it so agent and terminal runs share
      // one prebundle instead of rebuilding each other's.
      forwardConsole: false,
    },
  };
});
