import { createAuth, type Auth } from "./auth.ts";
import { handleDocuments, json, problem } from "./documents.ts";
import type { Env } from "./env.ts";
import { isDocumentId } from "./protocol.ts";
import { respondReader } from "./reader.ts";
import { asset, respondSite } from "./site.ts";

/** The password every development account shares; dev sign-in never runs in production. */
const DEV_PASSWORD = "productdoc-dev-password";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = new URL(env.BETTER_AUTH_URL).origin;
    const auth = createAuth(env);
    const response = await route(request, env, url, origin, auth).catch(
      (error: unknown) => {
        console.error(error);
        return problem(500, "productdoc.dev ran into a problem. Try again.");
      },
    );
    return withSecurityHeaders(response);
  },
};

async function route(
  request: Request,
  env: Env,
  url: URL,
  origin: string,
  auth: Auth,
) {
  const pathname = url.pathname;
  if (pathname.startsWith("/api/auth/")) return auth.handler(request);
  if (pathname === "/api/config") {
    return json(200, {
      providers: [
        ...(env.GOOGLE_CLIENT_ID ? ["google"] : []),
        ...(env.GITHUB_CLIENT_ID ? ["github"] : []),
      ],
      devSignIn: env.DEV_SIGN_IN === "1",
    });
  }
  if (pathname.startsWith("/api/admin/")) {
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (token === undefined || !(await sameSecret(token, env.ADMIN_TOKEN)))
      return problem(401, "Not allowed.");
    return admin(request, env, pathname.slice("/api/admin/".length));
  }
  if (pathname === "/api/dev/sign-in" && request.method === "POST")
    return devSignIn(request, env, auth);
  if (pathname === "/api/documents" || pathname.startsWith("/api/documents/")) {
    const parts = pathname.split("/").slice(3).filter(Boolean);
    const handled = await handleDocuments(
      { env, auth, request, origin },
      parts,
    );
    if (handled !== undefined) return handled;
    return problem(404, "Not found.");
  }
  if (pathname.startsWith("/api/")) return problem(404, "Not found.");
  if (pathname === "/device")
    return asset(env, request, "/device.html", "text/html; charset=utf-8", {
      "Cache-Control": "no-store",
    });
  if (pathname.startsWith("/d/"))
    return respondReader(env, request, url, origin);
  return respondSite(env, request, url);
}

function admin(request: Request, env: Env, path: string) {
  const [resource, key] = path.split("/");
  if (resource === "takedown" && key !== undefined && request.method === "POST")
    return takedown(request, env, key);
  if (resource === "publishers") {
    if (key === undefined && request.method === "GET")
      return listPublishers(env);
    const email = decodeURIComponent(key ?? "")
      .trim()
      .toLowerCase();
    if (email.includes("@")) {
      if (request.method === "PUT") return addPublisher(env, email);
      if (request.method === "DELETE") return removePublisher(env, email);
    }
  }
  return problem(404, "Not found.");
}

async function listPublishers(env: Env) {
  const { results } = await env.DB.prepare(
    `select "email" from "publisher" order by "email"`,
  ).all<{ email: string }>();
  return json(200, { publishers: results.map((row) => row.email) });
}

async function addPublisher(env: Env, email: string) {
  await env.DB.prepare(
    `insert into "publisher" ("email", "added_at") values (?, ?) on conflict do nothing`,
  )
    .bind(email, Date.now())
    .run();
  return json(200, { email, publisher: true });
}

async function removePublisher(env: Env, email: string) {
  const result = await env.DB.prepare(
    `delete from "publisher" where "email" = ?`,
  )
    .bind(email)
    .run();
  if (result.meta.changes === 0) return problem(404, "Not a publisher.");
  return json(200, { email, publisher: false });
}

/** Takes a reported document down; its files stay in R2 for the report's follow-up. */
async function takedown(request: Request, env: Env, id: string) {
  if (!isDocumentId(id)) return problem(404, "Not found.");
  const body = (await request.json().catch(() => ({}))) as {
    reason?: unknown;
  };
  const reason =
    typeof body.reason === "string" && body.reason.trim() !== ""
      ? body.reason.trim()
      : "Reported to abuse@productdoc.dev";
  const result = await env.DB.prepare(
    `update "document" set "removed_at" = ?, "removed_reason" = ? where "id" = ?`,
  )
    .bind(Date.now(), reason, id)
    .run();
  if (result.meta.changes === 0) return problem(404, "Not found.");
  return json(200, { id, removed: true });
}

async function sameSecret(a: string, b: string) {
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  const x = new Uint8Array(left);
  const y = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return difference === 0;
}

function digest(text: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
}

/** Local development: sign in as any email, creating the account the first time. */
async function devSignIn(request: Request, env: Env, auth: Auth) {
  if (env.DEV_SIGN_IN !== "1") return problem(404, "Not found.");
  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
  };
  const email =
    typeof body.email === "string" && body.email.includes("@")
      ? body.email
      : "dev@productdoc.dev";
  const signedIn = await auth.api.signInEmail({
    body: { email, password: DEV_PASSWORD },
    headers: request.headers,
    asResponse: true,
  });
  if (signedIn.ok) return signedIn;
  return auth.api.signUpEmail({
    body: { email, password: DEV_PASSWORD, name: email.split("@")[0] ?? email },
    headers: request.headers,
    asResponse: true,
  });
}

function withSecurityHeaders(response: Response) {
  const next = new Response(response.body, response);
  next.headers.set("X-Content-Type-Options", "nosniff");
  next.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!next.headers.has("X-Frame-Options"))
    next.headers.set("X-Frame-Options", "DENY");
  return next;
}
