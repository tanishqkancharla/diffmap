import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { previewFrameAncestors } from "./src/preview/protocol.ts";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

// Serves previews.html, the viewer's own stories, for preview and flow blocks in documents about the viewer.
export default defineConfig({
  cacheDir: path.join(packageRoot, "node_modules/.vite-previews"),
  plugins: [react()],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "purse-styles",
      "@storybook/react",
      "storybook",
    ],
  },
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 5201,
    strictPort: true,
    headers: { "Content-Security-Policy": previewFrameAncestors },
    forwardConsole: false,
  },
});
