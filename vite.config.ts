import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { gistAppConfig, mauiSourceEntry } from "./vite.gist.config.ts";

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
        "purse-styles",
        "@pierre/diffs/react",
        "beautiful-mermaid",
        "errore",
      ],
    },
    plugins: [react()],
    resolve: {
      alias: {
        maui: mauiSourceEntry,
      },
      dedupe: ["react", "react-dom", "purse-styles"],
    },
    clearScreen: false,
    server: {
      port: 4177,
      strictPort: false,
    },
  };
});
