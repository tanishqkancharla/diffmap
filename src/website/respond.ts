import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { markdownPath, pages, origin } from "./content.ts";
import { negotiate } from "./negotiate.ts";

/** Only public marketing/docs pages enter here. Shared documents never do. */
export async function respondPage(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  out = path.resolve("dist"),
) {
  res.setHeader("Vary", "Accept");
  // Do not rely on a CDN honoring arbitrary Vary keys. Neither representation is cached.
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.writeHead(405).end();
    return;
  }
  const normalized =
    pathname === "/" || pathname === "/index.html"
      ? "/"
      : pathname.replace(/\/$/, "");
  const host = req.headers.host?.split(":")[0]?.toLowerCase();
  if (host === "diffmap.dev" || host === "www.diffmap.dev") {
    // The original landing page is already in the shared viewer bundle.
    // Productdoc's docs/discovery pages must not replace the old site either.
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.writeHead(normalized === "/" ? 200 : 404);
    res.end(
      req.method === "HEAD"
        ? undefined
        : await fs.readFile(path.join(out, "viewer.html")),
    );
    return;
  }
  const discoveryTypes: Record<string, string> = {
    "/llms.txt": "text/plain; charset=utf-8",
    "/robots.txt": "text/plain; charset=utf-8",
    "/sitemap.xml": "application/xml; charset=utf-8",
  };
  const discoveryType = discoveryTypes[normalized];
  if (discoveryType) {
    res.setHeader("Content-Type", discoveryType);
    res.writeHead(200);
    res.end(
      req.method === "HEAD"
        ? undefined
        : await fs.readFile(path.join(out, normalized.slice(1))),
    );
    return;
  }
  const page = pages.find(
    (p) => p.path === normalized || markdownPath(p.path) === normalized,
  );
  if (!page) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.writeHead(404);
    res.end(
      req.method === "HEAD"
        ? undefined
        : await fs.readFile(path.join(out, "404.html")),
    );
    return;
  }
  const format = normalized.endsWith(".md")
    ? "md"
    : negotiate(req.headers.accept);
  if (format === "unacceptable") {
    res.writeHead(406).end();
    return;
  }
  res.setHeader(
    "Content-Type",
    format === "md"
      ? "text/markdown; charset=utf-8"
      : "text/html; charset=utf-8",
  );
  res.setHeader(
    "Link",
    `<${origin}${page.path}>; rel="canonical", <${origin}${markdownPath(page.path)}>; rel="alternate"; type="text/markdown", <${origin}/llms.txt>; rel="describedby"`,
  );
  const name =
    page.path === "/" ? "index" : page.path.slice(1).replaceAll("/", "--");
  res.writeHead(200);
  res.end(
    req.method === "HEAD"
      ? undefined
      : await fs.readFile(path.join(out, "pages", `${name}.${format}`)),
  );
}
