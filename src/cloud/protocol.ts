/**
 * What `product-doc share` uploads to productdoc.dev and what the reader at
 * /d/<id> loads back. The CLI, the Worker, and the reader all import this, so
 * it stays free of Node and Worker imports.
 */

export const DEFAULT_ORIGIN = "https://productdoc.dev";

/** The client id the CLI sends with device authorization. */
export const CLI_CLIENT_ID = "product-doc-cli";

export const LIMITS = {
  fileBytes: 25 * 1024 * 1024,
  versionBytes: 200 * 1024 * 1024,
  personBytes: 2 * 1024 * 1024 * 1024,
};

/** One stored file, addressed by the SHA-256 of its bytes. */
export type BlobRef = { hash: string; size: number; type: string };

/**
 * Which blobs one version shows. Pages and media keep the paths they have in
 * the document folder, so the viewer resolves `![](shot.png)` as it does locally.
 */
export type Manifest = {
  title: string;
  pages: Record<string, BlobRef>;
  media: Record<string, BlobRef>;
  /** JSON: the diff snapshot for each commit and changes card the pages reference. */
  changes: BlobRef | undefined;
  /** JSON: current contents of files that excerpts and references without a commit read. */
  files: BlobRef | undefined;
};

export type DocumentStatus = "shared" | "stopped" | "removed";

/** GET /api/documents/<id>: everything the reader needs before loading blobs. */
export type DocumentInfo = {
  id: string;
  status: DocumentStatus;
  owner: string;
  manifest: Manifest | undefined;
};

/** `.productdoc.json`, written into the document folder by `product-doc share`. */
export type LinkFile = { id: string; link: string };

export const LINK_FILE = ".productdoc.json";

export function documentLink(origin: string, id: string) {
  return `${origin}/d/${id}`;
}

export function blobUrl(id: string, hash: string) {
  return `/api/documents/${id}/blobs/${hash}`;
}

/** Ten lowercase letters and digits: unguessable enough for a public link and easy to read aloud. */
export function isDocumentId(value: string) {
  return /^[a-z0-9]{10}$/.test(value);
}

export function isBlobHash(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}

/** Every blob a manifest points at, once each. */
export function manifestBlobs(manifest: Manifest) {
  const refs = [
    ...Object.values(manifest.pages),
    ...Object.values(manifest.media),
    ...(manifest.changes === undefined ? [] : [manifest.changes]),
    ...(manifest.files === undefined ? [] : [manifest.files]),
  ];
  return [...new Map(refs.map((ref) => [ref.hash, ref])).values()];
}

/** Checks a manifest from the network without trusting its shape. */
export function parseManifest(value: unknown): Manifest | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string") return undefined;
  const pages = parseRefs(record.pages);
  const media = parseRefs(record.media);
  if (pages === undefined || media === undefined) return undefined;
  if (Object.keys(pages).length === 0) return undefined;
  const changes = optionalRef(record.changes);
  const files = optionalRef(record.files);
  if (changes === "invalid" || files === "invalid") return undefined;
  return { title: record.title, pages, media, changes, files };
}

function parseRefs(value: unknown) {
  if (typeof value !== "object" || value === null) return undefined;
  const refs: Record<string, BlobRef> = {};
  for (const [name, ref] of Object.entries(value)) {
    const parsed = parseRef(ref);
    if (parsed === undefined || !isSafePath(name)) return undefined;
    refs[name] = parsed;
  }
  return refs;
}

function optionalRef(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return parseRef(value) ?? "invalid";
}

function parseRef(value: unknown): BlobRef | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { hash, size, type } = value as Record<string, unknown>;
  if (typeof hash !== "string" || !isBlobHash(hash)) return undefined;
  if (typeof size !== "number" || !Number.isInteger(size) || size < 0)
    return undefined;
  if (typeof type !== "string" || type.length > 100) return undefined;
  return { hash, size, type };
}

/** A relative path inside the document folder, never climbing out of it. */
export function isSafePath(name: string) {
  if (name.length === 0 || name.length > 500) return false;
  if (name.startsWith("/") || name.includes("\\")) return false;
  return name.split("/").every((part) => part !== "" && part !== "..");
}
