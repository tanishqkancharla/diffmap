import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { respondPage } from "./respond.ts";

const types: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

/** Production-output preview, not Vite's SPA fallback (which masks 404s). */
export function createWebsiteServer(out = path.resolve("dist")) {
  return http.createServer((req, res) => {
    res.setHeader("X-Robots-Tag", "noindex");
    void (async () => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (
        /^\/g(?:\/|$)/.test(pathname) ||
        /^\/[^/]+\/[^/]+\/(?:pull|commit)\/[^/]+(?:\/|$)/.test(pathname)
      ) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          req.method === "HEAD"
            ? undefined
            : await fs.readFile(path.join(out, "viewer.html")),
        );
        return;
      }
      // Serve only generated public assets; /pages contains internal representations.
      if (
        /^\/assets\/[\w.-]+$/.test(pathname) ||
        /^\/(?:productdoc-logo\.svg|productdoc-social\.(?:svg|png)|og\.png)$/.test(
          pathname,
        )
      ) {
        const file = path.join(out, pathname.slice(1));
        const bytes = await fs.readFile(file).catch(() => undefined);
        if (bytes) {
          res.setHeader(
            "Content-Type",
            types[path.extname(file)] ?? "application/octet-stream",
          );
          res.end(req.method === "HEAD" ? undefined : bytes);
          return;
        }
      }
      await respondPage(req, res, pathname, out);
    })().catch((error: unknown) => {
      console.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end("Website response failed");
    });
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.PORT ?? "4178");
  createWebsiteServer().listen(port, "0.0.0.0", () =>
    console.log(`Productdoc preview listening on ${port}`),
  );
}
