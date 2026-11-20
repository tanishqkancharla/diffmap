import type { Env } from "./env.ts";

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
