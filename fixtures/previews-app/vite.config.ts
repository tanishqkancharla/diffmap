import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const diffmapSrc = fileURLToPath(new URL("../../src", import.meta.url));

// diffmap's viewer frames /previews.html, so only the viewer may embed it.
const previewFrameAncestors =
  "frame-ancestors 'self' http://127.0.0.1:* http://localhost:* https://www.diffmap.dev";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // A published app imports "product-doc/preview"; this example uses the checkout's source.
    alias: {
      "product-doc/preview": `${diffmapSrc}/preview/index.ts`,
    },
    dedupe: ["react", "react-dom", "@storybook/react", "storybook"],
  },
  server: {
    host: "127.0.0.1",
    port: 5200,
    strictPort: true,
    headers: { "Content-Security-Policy": previewFrameAncestors },
    fs: { allow: [".", diffmapSrc] },
  },
});
