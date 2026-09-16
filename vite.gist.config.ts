import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const gistRoot = path.join(packageRoot, "gist");

/** Production / preview: static gist viewer. Never pulls `virtual:tkstack`. */
export function gistAppConfig(): UserConfig {
  return {
    root: gistRoot,
    cacheDir: path.join(packageRoot, "node_modules/.vite-gist"),
    publicDir: false,
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
        "md4x/standalone",
      ],
    },
    plugins: [react()],
    appType: "spa",
    resolve: {
      alias: {
        "md4x/napi": path.join(
          packageRoot,
          "node_modules/md4x/lib/standalone.mjs",
        ),
      },
      dedupe: ["react", "react-dom", "purse-styles"],
    },
    server: {
      fs: {
        allow: [packageRoot],
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4178,
    },
    build: {
      outDir: path.join(packageRoot, "dist"),
      emptyOutDir: true,
    },
    clearScreen: false,
  };
}

export default defineConfig(gistAppConfig());
