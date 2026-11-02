import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

/** The local viewer, built once at publish time and served as static files by `serve`. */
export default defineConfig({
  root: packageRoot,
  publicDir: false,
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "purse-styles"],
  },
  build: {
    outDir: path.join(packageRoot, "viewer-dist"),
    emptyOutDir: true,
    // Shiki grammars and the main chunk are large, but only load from local disk.
    chunkSizeWarningLimit: 4096,
  },
  clearScreen: false,
});
