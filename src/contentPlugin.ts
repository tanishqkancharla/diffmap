import fs from "node:fs/promises";
import type { Plugin } from "vite";
import { parseViewerDocument } from "./parseViewer.js";

export function tkstackContentPlugin(input: {
  filePath: string;
  title: string;
}): Plugin {
  const virtualId = "\0virtual:tkstack";
  return {
    name: "tkstack-content",
    resolveId(id) {
      if (id === "virtual:tkstack") return virtualId;
    },
    async load(id) {
      if (id !== virtualId) return;
      const source = await fs.readFile(input.filePath, "utf8");
      const document = parseViewerDocument(source);
      if (document instanceof Error) throw document;
      return `export const viewerDocument = JSON.parse(${JSON.stringify(JSON.stringify(document))});`;
    },
    transformIndexHtml(html) {
      return html.replaceAll(
        "<title>tkstack</title>",
        `<title>${escapeHtml(input.title)}</title>`,
      );
    },
    configureServer(server) {
      server.watcher.add(input.filePath);
      server.watcher.on("change", (file) => {
        if (file !== input.filePath) return;
        const mod = server.moduleGraph.getModuleById(virtualId);
        if (mod === undefined) return;
        // oxlint-disable-next-line typescript/no-floating-promises -- Vite watcher callbacks cannot await module reloads.
        void server.reloadModule(mod);
      });
    },
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
