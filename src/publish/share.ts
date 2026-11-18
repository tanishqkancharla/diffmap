import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  LIMITS,
  LINK_FILE,
  type BlobRef,
  type LinkFile,
  type Manifest,
} from "../cloud/protocol.js";
import { DiffmapShareError, ProductdocRequestError } from "../errors.js";
import { isLocalMedia, isVideoSource } from "../media.js";
import { collectMedia } from "../parseViewer.js";
import { parseSpec, readSpec } from "../readSpec.js";
import { readSnapshots } from "../share.js";
import { forgetToken, login, savedToken } from "./auth.js";
import { secretReason } from "./secrets.js";

type Blob = BlobRef & { bytes: Uint8Array; label: string };

type Log = (line: string) => void;

/**
 * Uploads a document folder to productdoc.dev as a new public link, and writes
 * the link into the folder's `.productdoc.json`.
 */
export async function shareDocument(input: {
  dir: string;
  workspaceRoot: string;
  origin: string;
  /** Files the person checked and wants shared despite the checks. */
  allow: string[];
  log: Log;
}) {
  const bundle = await bundleDocument(input);
  if (bundle instanceof Error) return bundle;
  const { manifest, blobs, sourceFiles, summary } = bundle;

  const token = await signedIn(input.origin, input.log);
  if (token instanceof Error) return token;
  input.log(`Uploading ${summary}`);
  let api = client(input.origin, token);
  let created = await api.post("/api/documents", { title: manifest.title });
  if (created instanceof ProductdocRequestError && created.status === 401) {
    // The saved sign-in ended on productdoc.dev; sign in again once.
    await forgetToken(input.origin);
    const fresh = await signedIn(input.origin, input.log);
    if (fresh instanceof Error) return fresh;
    api = client(input.origin, fresh);
    created = await api.post("/api/documents", { title: manifest.title });
  }
  if (created instanceof Error) return created;
  const { id } = created as { id: string };

  const missing = await api.post(`/api/documents/${id}/missing`, {
    hashes: blobs.map((blob) => blob.hash),
  });
  if (missing instanceof Error) return missing;
  const wanted = new Set((missing as { missing: string[] }).missing);
  for (const blob of blobs) {
    if (!wanted.has(blob.hash)) continue;
    const put = await api.put(
      `/api/documents/${id}/blobs/${blob.hash}`,
      blob.bytes,
      blob.type,
    );
    if (put instanceof Error) return put;
  }
  const version = await api.post(`/api/documents/${id}/versions`, {
    manifest,
  });
  if (version instanceof Error) return version;
  const { link } = version as { link: string };
  if (sourceFiles.length > 0)
    input.log(`Now public: ${sourceFiles.join(", ")}`);
  const linkFile: LinkFile = { id, link };
  await fs.writeFile(
    path.join(input.dir, LINK_FILE),
    `${JSON.stringify(linkFile, undefined, 2)}\n`,
  );
  return {
    id,
    link,
    publicSourceFiles: sourceFiles,
    pages: Object.keys(manifest.pages).length,
    media: Object.keys(manifest.media).length,
    bytes: blobs.reduce((sum, blob) => sum + blob.size, 0),
  };
}

/** Deletes the link in the folder's `.productdoc.json`, and the file. */
export async function stopSharing(input: {
  dir: string;
  origin: string;
  log: Log;
}) {
  const linkPath = path.join(input.dir, LINK_FILE);
  const text = await fs.readFile(linkPath, "utf8").catch(() => undefined);
  const linkFile = parseLinkFile(text);
  if (linkFile === undefined) {
    return new DiffmapShareError({
      reason: `${path.relative(process.cwd(), linkPath) || LINK_FILE} has no link, so this document isn't shared from this folder`,
    });
  }
  const token = await signedIn(input.origin, input.log);
  if (token instanceof Error) return token;
  const stopped = await client(input.origin, token).delete(
    `/api/documents/${linkFile.id}`,
  );
  if (stopped instanceof Error) return stopped;
  await fs.rm(linkPath, { force: true });
  return { link: linkFile.link, stopped: true as const };
}

async function signedIn(origin: string, log: Log) {
  const token = await savedToken(origin);
  if (token !== undefined) return token;
  const result = await login({ origin, log });
  if (result instanceof Error) return result;
  const fresh = await savedToken(origin);
  return (
    fresh ??
    new DiffmapShareError({ reason: "the sign-in didn't save a token" })
  );
}

/** Everything a reader needs, as hashed blobs, after the size and privacy checks. */
async function bundleDocument(input: {
  dir: string;
  workspaceRoot: string;
  allow: string[];
}) {
  const read = await readSpec(path.resolve(input.dir));
  if (read instanceof Error) return read;
  const pages = parseSpec(read);
  if (pages instanceof Error) return pages;
  const specDir = path.resolve(input.dir);
  const allowed = new Set(
    input.allow.map((file) =>
      path.relative(input.workspaceRoot, path.resolve(file)),
    ),
  );

  const blobs = new Map<string, Blob>();
  const add = (label: string, bytes: Uint8Array, type: string): BlobRef => {
    const hash = createHash("sha256").update(bytes).digest("hex");
    const ref = { hash, size: bytes.byteLength, type };
    if (!blobs.has(hash)) blobs.set(hash, { ...ref, bytes, label });
    return ref;
  };
  // Workspace-relative path → text, for the privacy checks.
  const checked = new Map<string, string | undefined>();

  const manifest: Manifest = {
    title: read.spec.title,
    pages: {},
    media: {},
    changes: undefined,
    files: undefined,
  };
  for (const page of pages) {
    const bytes = await fs.readFile(page.path);
    manifest.pages[page.file] = add(page.file, bytes, "text/markdown");
    checked.set(page.path, bytes.toString("utf8"));
    for (const src of collectMedia(page.document.nodes).filter(isLocalMedia)) {
      const name = src.replace(/^\.\//, "").split(/[?#]/)[0] ?? src;
      if (manifest.media[name] !== undefined) continue;
      const file = path.resolve(specDir, decodeURIComponent(name));
      const media = await fs.readFile(file).catch(() => undefined);
      if (media === undefined) {
        return new DiffmapShareError({
          reason: `${page.file} shows ${src}, which doesn't exist`,
        });
      }
      manifest.media[name] = add(name, media, mediaType(name));
      checked.set(file, undefined);
    }
  }

  const snapshot = await readSnapshots(input.workspaceRoot, pages);
  if (snapshot instanceof Error) return snapshot;
  const sourceFiles = new Set(Object.keys(snapshot.files));
  for (const [file, text] of Object.entries(snapshot.files))
    checked.set(path.resolve(input.workspaceRoot, file), text);
  for (const changes of snapshot.changes.values()) {
    for (const changed of changes.files) {
      sourceFiles.add(changed.path);
      checked.set(
        path.resolve(input.workspaceRoot, changed.path),
        changed.contents?.new,
      );
    }
    for (const [file, text] of Object.entries(changes.sources ?? {})) {
      sourceFiles.add(file);
      checked.set(path.resolve(input.workspaceRoot, file), text);
    }
  }
  if (snapshot.changes.size > 0) {
    manifest.changes = add(
      "diff snapshots",
      Buffer.from(JSON.stringify(Object.fromEntries(snapshot.changes))),
      "application/json",
    );
  }
  if (Object.keys(snapshot.files).length > 0) {
    manifest.files = add(
      "source files",
      Buffer.from(JSON.stringify(snapshot.files)),
      "application/json",
    );
  }

  const ignored = await gitIgnored(input.workspaceRoot, [...checked.keys()]);
  for (const [file, text] of checked) {
    const relative = path.relative(input.workspaceRoot, file);
    if (allowed.has(relative)) continue;
    const reason = ignored.has(file)
      ? "it's gitignored"
      : secretReason(relative, text);
    if (reason !== undefined) {
      return new DiffmapShareError({
        reason: `${relative} would be shared, but ${reason}. Nothing was uploaded. Remove it from the document, or check it and share again with --allow ${relative}`,
      });
    }
  }

  const all = [...blobs.values()];
  for (const blob of all) {
    if (blob.size > LIMITS.fileBytes) {
      return new DiffmapShareError({
        reason: `${blob.label} is ${megabytes(blob.size)}, over the ${megabytes(LIMITS.fileBytes)} limit for one file. Nothing was uploaded. Make it smaller and share again`,
      });
    }
  }
  const total = all.reduce((sum, blob) => sum + blob.size, 0);
  if (total > LIMITS.versionBytes) {
    return new DiffmapShareError({
      reason: `the document is ${megabytes(total)}, over the ${megabytes(LIMITS.versionBytes)} limit. Nothing was uploaded`,
    });
  }

  const images = Object.keys(manifest.media).filter(
    (name) => !isVideoSource(name),
  ).length;
  const recordings = Object.keys(manifest.media).length - images;
  const parts = [
    plural(Object.keys(manifest.pages).length, "page"),
    images > 0 ? plural(images, "screenshot") : undefined,
    recordings > 0 ? plural(recordings, "recording") : undefined,
    snapshot.changes.size > 0
      ? `${plural(snapshot.changes.size, "commit")} of diffs`
      : undefined,
  ].filter((part) => part !== undefined);
  return {
    manifest,
    blobs: all,
    sourceFiles: [...sourceFiles].toSorted(),
    summary: `${listing(parts)} (${megabytes(total)})`,
  };
}

/** Which of these absolute paths git ignores. Outside a repository, none. */
async function gitIgnored(root: string, files: string[]) {
  if (files.length === 0) return new Set<string>();
  const result = await new Promise<string>((resolve) => {
    const child = execFile(
      "git",
      ["check-ignore", "--no-index", "--stdin", "-z"],
      { cwd: root, maxBuffer: 10_000_000 },
      (_error, stdout) => resolve(stdout),
    );
    child.stdin?.end(files.map((file) => `${file}\0`).join(""));
  });
  return new Set(
    result
      .split("\0")
      .filter(Boolean)
      .map((file) => path.resolve(root, file)),
  );
}

function client(origin: string, token: string) {
  const send = async (pathname: string, init: RequestInit) => {
    const response = await fetch(`${origin}${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...init.headers },
    }).catch(
      (cause: unknown) =>
        new ProductdocRequestError({
          reason: `${new URL(origin).host} can't be reached, so nothing was shared. Check the connection and share again`,
          cause,
        }),
    );
    if (response instanceof Error) return response;
    const body = (await response.json().catch(() => ({}))) as {
      error?: unknown;
    };
    if (!response.ok) {
      const error = new ProductdocRequestError({
        reason:
          typeof body.error === "string"
            ? body.error
            : `productdoc.dev answered ${String(response.status)}`,
      });
      error.status = response.status;
      return error;
    }
    return body as unknown;
  };
  const json = (method: string) => (pathname: string, body?: unknown) =>
    send(pathname, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    post: json("POST"),
    delete: json("DELETE"),
    put: (pathname: string, bytes: Uint8Array, type: string) =>
      send(pathname, {
        method: "PUT",
        headers: { "Content-Type": type },
        body: bytes as Uint8Array<ArrayBuffer>,
      }),
  };
}

export function parseLinkFile(text: string | undefined) {
  if (text === undefined) return undefined;
  try {
    const value = JSON.parse(text) as Partial<LinkFile>;
    return typeof value.id === "string" && typeof value.link === "string"
      ? { id: value.id, link: value.link }
      : undefined;
  } catch {
    return undefined;
  }
}

const MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
  ogv: "video/ogg",
};

function mediaType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return MEDIA_TYPES[extension] ?? "application/octet-stream";
}

function megabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
}

function plural(count: number, noun: string) {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function listing(parts: string[]) {
  if (parts.length <= 2) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1) ?? ""}`;
}
