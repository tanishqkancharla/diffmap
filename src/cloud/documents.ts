import type { Auth } from "./auth.ts";
import type { Env } from "./env.ts";
import {
  LIMITS,
  documentLink,
  isBlobHash,
  isDocumentId,
  manifestBlobs,
  parseManifest,
  type DocumentInfo,
  type DocumentStatus,
  type Manifest,
} from "./protocol.ts";

type DocumentRow = {
  id: string;
  owner_id: string;
  title: string;
  latest_version: number | null;
  stopped_at: number | null;
  removed_at: number | null;
  owner_name: string;
};

type Context = { env: Env; auth: Auth; request: Request; origin: string };

/** Routes under /api/documents. Returns undefined for paths it doesn't own. */
export async function handleDocuments(
  context: Context,
  parts: string[],
): Promise<Response | undefined> {
  const method = context.request.method;
  const [id, resource, key] = parts;
  if (id === undefined) {
    return method === "POST" ? createDocument(context) : notAllowed("POST");
  }
  if (!isDocumentId(id)) return problem(404, "No document has this id.");
  if (resource === undefined) {
    if (method === "GET") return readDocument(context, id);
    if (method === "DELETE") return stopDocument(context, id);
    return notAllowed("GET, DELETE");
  }
  if (resource === "missing" && key === undefined) {
    return method === "POST" ? missingBlobs(context, id) : notAllowed("POST");
  }
  if (resource === "blobs" && key !== undefined && parts.length === 3) {
    if (!isBlobHash(key)) return problem(404, "No file has this hash.");
    if (method === "PUT") return putBlob(context, id, key);
    if (method === "GET" || method === "HEAD") return getBlob(context, id, key);
    return notAllowed("GET, HEAD, PUT");
  }
  if (resource === "versions" && key === undefined) {
    return method === "POST" ? commitVersion(context, id) : notAllowed("POST");
  }
  return undefined;
}

async function createDocument(context: Context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson(context.request);
  const title =
    typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (title === "") return problem(400, "A document needs a title.");
  const id = newDocumentId();
  await context.env.DB.prepare(
    `insert into "document" ("id", "owner_id", "title", "created_at") values (?, ?, ?, ?)`,
  )
    .bind(id, user.id, title, Date.now())
    .run();
  return json(201, { id, link: documentLink(context.origin, id) });
}

async function readDocument(context: Context, id: string) {
  const row = await findDocument(context.env, id);
  if (row === undefined || row.latest_version === null)
    return problem(404, "No document has this id.");
  const status = documentStatus(row);
  const info: DocumentInfo = {
    id,
    status,
    owner: row.owner_name,
    manifest:
      status === "shared"
        ? await readManifest(context.env, id, row.latest_version)
        : undefined,
  };
  return json(200, info, { "Cache-Control": "no-store" });
}

async function stopDocument(context: Context, id: string) {
  const owned = await ownedDocument(context, id);
  if (owned instanceof Response) return owned;
  if (owned.row.stopped_at !== null) return json(200, { stopped: true });
  const manifests = await readAllManifests(context.env, owned.row);
  await context.env.DB.prepare(
    `update "document" set "stopped_at" = ? where "id" = ?`,
  )
    .bind(Date.now(), id)
    .run();
  // The link keeps saying who stopped sharing it; the files go.
  const keys = manifests.flatMap((manifest) =>
    manifestBlobs(manifest).map((ref) => blobKey(id, ref.hash)),
  );
  for (let i = 0; i < keys.length; i += 1000)
    await context.env.BLOBS.delete(keys.slice(i, i + 1000));
  return json(200, { stopped: true });
}

async function missingBlobs(context: Context, id: string) {
  const owned = await ownedDocument(context, id);
  if (owned instanceof Response) return owned;
  const body = await readJson(context.request);
  const hashes = Array.isArray(body?.hashes)
    ? body.hashes.filter(
        (hash): hash is string => typeof hash === "string" && isBlobHash(hash),
      )
    : [];
  const missing: string[] = [];
  for (const hash of new Set(hashes)) {
    const head = await context.env.BLOBS.head(blobKey(id, hash));
    if (head === null) missing.push(hash);
  }
  return json(200, { missing });
}

async function putBlob(context: Context, id: string, hash: string) {
  const owned = await ownedDocument(context, id);
  if (owned instanceof Response) return owned;
  const length = Number(context.request.headers.get("Content-Length"));
  if (!Number.isFinite(length) || length < 0)
    return problem(411, "Send the file with a Content-Length.");
  if (length > LIMITS.fileBytes)
    return problem(
      413,
      `Files can be at most ${formatBytes(LIMITS.fileBytes)}.`,
    );
  if (context.request.body === null)
    return problem(400, "Send the file in the request body.");
  // R2 checks the hash as it stores the stream, which keeps a large file
  // within the Worker's CPU limit.
  const stored = await context.env.BLOBS.put(
    blobKey(id, hash),
    context.request.body,
    {
      sha256: hash,
      httpMetadata: {
        contentType:
          context.request.headers.get("Content-Type") ??
          "application/octet-stream",
      },
    },
  ).catch(() => undefined);
  if (stored === undefined)
    return problem(400, "The file's contents don't match its hash.");
  return json(201, { hash });
}

async function getBlob(context: Context, id: string, hash: string) {
  const row = await findDocument(context.env, id);
  if (row === undefined || documentStatus(row) !== "shared")
    return problem(404, "This file isn't shared.");
  const object = await context.env.BLOBS.get(blobKey(id, hash));
  if (object === null) return problem(404, "This file isn't shared.");
  const type = object.httpMetadata?.contentType ?? "application/octet-stream";
  return new Response(
    context.request.method === "HEAD" ? undefined : object.body,
    {
      headers: {
        "Content-Type": servedType(type),
        "Content-Length": String(object.size),
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
        // Nothing from a document runs on productdoc.dev, even an SVG opened on its own.
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src 'self'; sandbox",
      },
    },
  );
}

async function commitVersion(context: Context, id: string) {
  const owned = await ownedDocument(context, id);
  if (owned instanceof Response) return owned;
  const { row, user } = owned;
  if (row.stopped_at !== null || row.removed_at !== null)
    return problem(
      409,
      "This document is no longer shared. Share it again for a new link.",
    );
  const body = await readJson(context.request);
  const manifest = parseManifest(body?.manifest);
  if (manifest === undefined)
    return problem(400, "The version's manifest isn't valid.");
  const blobs = manifestBlobs(manifest);
  const bytes = blobs.reduce((sum, ref) => sum + ref.size, 0);
  if (bytes > LIMITS.versionBytes)
    return problem(
      413,
      `A version can be at most ${formatBytes(LIMITS.versionBytes)}.`,
    );
  for (const ref of blobs) {
    const head = await context.env.BLOBS.head(blobKey(id, ref.hash));
    if (head === null)
      return problem(409, `The file ${ref.hash.slice(0, 12)} wasn't uploaded.`);
  }
  const used = await context.env.DB.prepare(
    `select coalesce(sum(v."bytes"), 0) as "bytes" from "document_version" v
     join "document" d on d."id" = v."document_id"
     where d."owner_id" = ? and d."stopped_at" is null and d."removed_at" is null`,
  )
    .bind(user.id)
    .first<{ bytes: number }>();
  if ((used?.bytes ?? 0) + bytes > LIMITS.personBytes)
    return problem(
      413,
      `You can share at most ${formatBytes(LIMITS.personBytes)} in total. Stop sharing an older document to make room.`,
    );
  const latest = await context.env.DB.prepare(
    `select "n", "created_at" from "document_version" where "document_id" = ? order by "n" desc limit 1`,
  )
    .bind(id)
    .first<{ n: number; created_at: number }>();
  if (latest !== null && Date.now() - latest.created_at < 2000)
    return problem(429, "Wait a couple of seconds between versions.");
  const n = (latest?.n ?? 0) + 1;
  const manifestJson = JSON.stringify(manifest);
  await context.env.BLOBS.put(versionKey(id, n), manifestJson, {
    httpMetadata: { contentType: "application/json" },
  });
  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `insert into "document_version" ("document_id", "n", "manifest_hash", "bytes", "published_by", "created_at") values (?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      n,
      await sha256(new TextEncoder().encode(manifestJson)),
      bytes,
      user.id,
      now,
    ),
    context.env.DB.prepare(
      `update "document" set "latest_version" = ?, "title" = ? where "id" = ?`,
    ).bind(n, manifest.title.slice(0, 200), id),
  ]);
  return json(201, { n, link: documentLink(context.origin, id) });
}

export async function findDocument(env: Env, id: string) {
  const row = await env.DB.prepare(
    `select d."id", d."owner_id", d."title", d."latest_version", d."stopped_at", d."removed_at", u."name" as "owner_name"
     from "document" d join "user" u on u."id" = d."owner_id" where d."id" = ?`,
  )
    .bind(id)
    .first<DocumentRow>();
  return row ?? undefined;
}

export function documentStatus(row: DocumentRow): DocumentStatus {
  if (row.removed_at !== null) return "removed";
  if (row.stopped_at !== null) return "stopped";
  return "shared";
}

export async function readManifest(env: Env, id: string, n: number) {
  const object = await env.BLOBS.get(versionKey(id, n));
  if (object === null) return undefined;
  return parseManifest(JSON.parse(await object.text()) as unknown);
}

async function readAllManifests(env: Env, row: DocumentRow) {
  const manifests: Manifest[] = [];
  for (let n = 1; n <= (row.latest_version ?? 0); n++) {
    const manifest = await readManifest(env, row.id, n);
    if (manifest !== undefined) manifests.push(manifest);
  }
  return manifests;
}

export async function readBlobText(env: Env, id: string, hash: string) {
  const object = await env.BLOBS.get(blobKey(id, hash));
  return object === null ? undefined : object.text();
}

async function ownedDocument(context: Context, id: string) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const row = await findDocument(context.env, id);
  // Someone else's document looks the same as a missing one.
  if (row === undefined || row.owner_id !== user.id)
    return problem(404, "You have no document with this id.");
  return { row, user };
}

async function requireUser(context: Context) {
  const session = await context.auth.api.getSession({
    headers: context.request.headers,
  });
  if (session === null)
    return problem(401, "Sign in first: run product-doc login.");
  if (!canPublish(context.env, session.user))
    return problem(
      403,
      "Sharing to productdoc.dev isn't open to this account.",
    );
  return session.user;
}

/** Without PUBLISHERS, as in local development, every account can publish. */
function canPublish(env: Env, user: { email: string; emailVerified: boolean }) {
  if (env.PUBLISHERS === undefined) return true;
  const publishers = env.PUBLISHERS.split(",").map((email) =>
    email.trim().toLowerCase(),
  );
  const verified = user.emailVerified || env.DEV_SIGN_IN === "1";
  return verified && publishers.includes(user.email.toLowerCase());
}

function blobKey(id: string, hash: string) {
  return `documents/${id}/blobs/${hash}`;
}

function versionKey(id: string, n: number) {
  return `documents/${id}/versions/${String(n)}.json`;
}

/** Images, recordings, Markdown, and JSON are served as themselves; anything else downloads. */
function servedType(type: string) {
  if (/^(?:image|video)\/[\w.+-]+$/.test(type)) return type;
  if (type.startsWith("text/markdown")) return "text/markdown; charset=utf-8";
  if (type.startsWith("application/json"))
    return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function newDocumentId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

async function sha256(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatBytes(bytes: number) {
  return bytes >= 1024 ** 3
    ? `${String(bytes / 1024 ** 3)} GB`
    : `${String(bytes / 1024 ** 2)} MB`;
}

async function readJson(request: Request) {
  const value = (await request.json().catch(() => undefined)) as unknown;
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown> & { hashes?: unknown })
    : undefined;
}

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return Response.json(body, { status, headers });
}

export function problem(status: number, message: string) {
  return json(status, { error: message });
}

function notAllowed(allow: string) {
  return new Response(undefined, { status: 405, headers: { Allow: allow } });
}
