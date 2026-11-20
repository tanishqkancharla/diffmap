import { makeSpec } from "../spec.ts";
import { negotiate } from "../website/negotiate.ts";
import {
  documentStatus,
  findDocument,
  readBlobText,
  readManifest,
} from "./documents.ts";
import type { Env } from "./env.ts";
import { documentLink, isDocumentId } from "./protocol.ts";
import { asset, notFound } from "./site.ts";

/**
 * /d/<id>, and /d/<id>/<page>: the reader app for people, or the document's
 * pages as one Markdown file for agents (`Accept: text/markdown` or `.md`).
 */
export async function respondReader(
  env: Env,
  request: Request,
  url: URL,
  origin: string,
) {
  const [, , rawId = "", ...rest] = url.pathname.split("/");
  const markdownSuffix = rest.length === 0 && rawId.endsWith(".md");
  const id = markdownSuffix ? rawId.slice(0, -3) : rawId;
  if (!isDocumentId(id)) return notFound(env, request);
  const link = documentLink(origin, id);
  const wantsMarkdown =
    markdownSuffix ||
    negotiate(request.headers.get("Accept") ?? undefined) === "md";
  const discovery = {
    Vary: "Accept",
    Link: `<${link}>; rel="canonical", <${link}.md>; rel="alternate"; type="text/markdown"`,
  };
  if (!wantsMarkdown) {
    return asset(env, request, "/shared.html", "text/html; charset=utf-8", {
      ...discovery,
      "Cache-Control": "no-store",
    });
  }
  const markdown = await documentMarkdown(env, id, link);
  return new Response(markdown.body, {
    status: markdown.status,
    headers: {
      ...discovery,
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function documentMarkdown(env: Env, id: string, link: string) {
  const row = await findDocument(env, id);
  if (row === undefined || row.latest_version === null)
    return { status: 404, body: "No document is shared at this link.\n" };
  const status = documentStatus(row);
  if (status === "stopped")
    return {
      status: 410,
      body: `${row.owner_name} stopped sharing this document.\n`,
    };
  if (status === "removed")
    return {
      status: 410,
      body: "This document was removed for breaking productdoc's rules.\n",
    };
  const manifest = await readManifest(env, id, row.latest_version);
  if (manifest === undefined)
    return { status: 500, body: "This document's files are missing.\n" };
  const files = Object.entries(manifest.pages).map(([file, ref]) => ({
    file,
    source: ref.hash,
  }));
  const spec = makeSpec(id, files);
  const ordered = spec instanceof Error ? files : spec.pages;
  const sections: string[] = [
    `<!-- ${manifest.title}, shared by ${row.owner_name} at ${link}. Pages follow in order, each after a page comment. -->`,
  ];
  for (const page of ordered) {
    const text = await readBlobText(env, id, page.source);
    if (text === undefined) continue;
    sections.push(`<!-- page: ${page.file} -->\n\n${text.trim()}`);
  }
  return { status: 200, body: `${sections.join("\n\n")}\n` };
}
