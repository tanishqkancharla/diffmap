import { markdownPath, origin, pages } from "../website/content.ts";
import { negotiate } from "../website/negotiate.ts";
import type { Env } from "./env.ts";

/** Hosted viewer routes for gists and GitHub, unchanged from the Vercel deployment. */
const VIEWER_ROUTE =
  /^\/g(?:\/|$)|^\/[^/]+\/[^/]+\/(?:pull|commit)\/[^/]+(?:\/|$)/;
const ASSET_ROUTE =
  /^\/assets\/[\w.-]+$|^\/(?:productdoc-logo\.svg|productdoc-social\.(?:svg|png)|og\.png)$/;
const DISCOVERY: Record<string, string> = {
  "/llms.txt": "text/plain; charset=utf-8",
  "/robots.txt": "text/plain; charset=utf-8",
  "/sitemap.xml": "application/xml; charset=utf-8",
};

/** The productdoc.dev website, as `src/website/respond.ts` serves it on Vercel. */
export async function respondSite(env: Env, request: Request, url: URL) {
  const pathname = url.pathname;
  if (ASSET_ROUTE.test(pathname)) return asset(env, request, pathname);
  if (VIEWER_ROUTE.test(pathname))
    return asset(env, request, "/viewer.html", "text/html; charset=utf-8");
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response(undefined, {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  const normalized =
    pathname === "/" || pathname === "/index.html"
      ? "/"
      : pathname.replace(/\/$/, "");
  const headers = {
    Vary: "Accept",
    "Cache-Control": "private, no-store",
  };
  const discovery = DISCOVERY[normalized];
  if (discovery !== undefined)
    return asset(env, request, normalized, discovery, headers);
  const page = pages.find(
    (p) => p.path === normalized || markdownPath(p.path) === normalized,
  );
  if (page === undefined) return notFound(env, request);
  const format = normalized.endsWith(".md")
    ? "md"
    : negotiate(request.headers.get("Accept") ?? undefined);
  if (format === "unacceptable")
    return new Response(undefined, { status: 406 });
  const name =
    page.path === "/" ? "index" : page.path.slice(1).replaceAll("/", "--");
  return asset(
    env,
    request,
    `/pages/${name}.${format}`,
    format === "md"
      ? "text/markdown; charset=utf-8"
      : "text/html; charset=utf-8",
    {
      ...headers,
      Link: `<${origin}${page.path}>; rel="canonical", <${origin}${markdownPath(page.path)}>; rel="alternate"; type="text/markdown", <${origin}/llms.txt>; rel="describedby"`,
    },
  );
}

export async function notFound(env: Env, request: Request) {
  const page = await asset(
    env,
    request,
    "/404.html",
    "text/html; charset=utf-8",
  );
  return new Response(page.body, { status: 404, headers: page.headers });
}

/** A file from the website build, optionally relabeled. */
export async function asset(
  env: Env,
  request: Request,
  pathname: string,
  type?: string,
  headers: Record<string, string> = {},
) {
  const response = await env.ASSETS.fetch(
    new Request(new URL(pathname, request.url), { method: request.method }),
  );
  if (!response.ok) return response;
  const next = new Response(response.body, response);
  if (type !== undefined) next.headers.set("Content-Type", type);
  for (const [name, value] of Object.entries(headers))
    next.headers.set(name, value);
  return next;
}
