import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const gistRoot = path.join(packageRoot, "gist");

/** Production / preview: static gist viewer. Never pulls `virtual:diffmap`. */
export function gistAppConfig(): UserConfig {
  return {
    root: gistRoot,
    cacheDir: path.join(packageRoot, "node_modules/.vite-gist"),
    // Copied to the site root as-is, such as `/og.png` for link previews.
    publicDir: path.join(gistRoot, "public"),
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
        "md4x/standalone",
      ],
    },
    plugins: [
      react(),
      {
        name: "productdoc-static-pages",
        apply: "build",
        closeBundle() {
          execFileSync(
            process.execPath,
            ["--import", "tsx", "src/website/build.tsx"],
            {
              cwd: packageRoot,
              stdio: "inherit",
            },
          );
        },
      },
    ],
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
      rollupOptions: {
        input: {
          viewer: path.join(gistRoot, "index.html"),
          website: path.join(gistRoot, "website.html"),
          shared: path.join(gistRoot, "shared.html"),
          device: path.join(gistRoot, "device.html"),
        },
      },
      outDir: path.join(packageRoot, "dist"),
      emptyOutDir: true,
    },
    clearScreen: false,
  };
}

export default defineConfig(gistAppConfig());
