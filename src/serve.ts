import { createHash, randomBytes } from "node:crypto";
import { createReadStream, watch, type FSWatcher } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { pipeline, type Duplex } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { DiffmapFileError, DiffmapServeError } from "./errors.js";
import { findPage, isMarkdownFile, type SpecPage } from "./spec.js";
import { parseViewerDocument, type ViewerDocument } from "./parseViewer.js";
import { parseSpec, readSpec } from "./readSpec.js";
import {
  findUnlistedFiles,
  listDeltas,
  readChanges,
  readDocumentChanges,
} from "./git.js";
import type { Changes, Rev } from "./changes.js";
import {
  registerRunningDiffmap,
  unregisterRunningDiffmap,
} from "./registry.js";

export type DiffmapServer = {
  url: string;
  filePath: string;
  /** Changed files a commit's `changes` card leaves unlisted, one line per card. */
  warnings: string[];
  /** Every page of the spec as it was parsed at startup. */
  documents: ViewerDocument[];
  shutdown: () => Promise<void>;
  closed: Promise<void>;
};

/** What the local viewer may report to `/__diffmap/telemetry`, with each property's allowed values; nothing from the spec. */
const viewerEventSchema = {
  viewer_opened: {},
  viewer_engaged: { trigger: ["time", "scroll"] },
  comment_added: { target: ["text", "lines"] },
  comments_copied: {},
  code_copied: {},
  diff_opened: {},
  reference_opened: {},
  file_reviewed: {},
  range_changed: {},
  diagram_used: { action: ["play", "fullscreen"] },
  viewer_error: { kind: ["document", "source", "excerpt", "changes"] },
  server_closed: {},
} as const satisfies Record<string, Record<string, readonly string[]>>;

type ViewerEventSchema = typeof viewerEventSchema;
export type ViewerEvent = {
  [E in keyof ViewerEventSchema]: { event: E } & {
    -readonly [
      P in keyof ViewerEventSchema[E]
    ]: ViewerEventSchema[E][P] extends readonly (infer V)[] ? V : never;
  };
}[keyof ViewerEventSchema];

export type StartServerInput = {
  /** The spec's directory. */
  filePath: string;
  workspaceRoot: string;
  port?: number;
  /** Called for each event the viewer page reports; the CLI forwards them to telemetry. */
  onViewerEvent?: (event: ViewerEvent) => void;
};

const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
/** Written by `npm run build:viewer`; published with the package. */
const viewerDist = path.join(packageRoot, "viewer-dist");

function noop() {}

/** A WebSocket text frame. The reload socket sends the changed page's file name, or `pages` when the list of pages changed. */
function textFrame(text: string) {
  const payload = Buffer.from(text);
  const header =
    payload.length < 126
      ? Buffer.from([0x81, payload.length])
      : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);
  return Buffer.concat([header, payload]);
}

/** What the page list shows, to tell an edit inside a page from a change to the list. */
function pageOutline(pages: SpecPage[]) {
  return JSON.stringify(
    pages.map((page) => [page.file, page.slug, page.title]),
  );
}

function createClosedBarrier() {
  let resolveFn = noop;
  const closed = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });
  return {
    closed,
    resolve() {
      resolveFn();
    },
  };
}

export async function startServer(input: StartServerInput) {
  const filePath = path.resolve(input.filePath);
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const port = input.port ?? 0;
  const read = await readSpec(filePath);
  if (read instanceof Error) return read;
  const parsed = parseSpec(read);
  if (parsed instanceof Error) return parsed;
  const changes = new Map<Rev, Changes>();
  const warnings: string[] = [];
  for (const page of parsed) {
    const pageChanges = await readDocumentChanges(workspaceRoot, page.document);
    if (pageChanges instanceof Error) return pageChanges;
    for (const [rev, value] of pageChanges) changes.set(rev, value);
    warnings.push(...findUnlistedFiles(page.document.changeCards, changes));
  }
  const specDir = read.dir;

  const title = read.spec.title;
  // DIFFMAP_DEV serves the viewer from source through Vite, with hot reload, for working on diffmap itself.
  const dev = process.env.DIFFMAP_DEV === "1";
  if (!dev && !(await isFile(path.join(viewerDist, "index.html")))) {
    return new DiffmapServeError({
      reason: `the viewer is not built in ${viewerDist}. Run \`npm run build:viewer\`, or set DIFFMAP_DEV=1 to serve it from source`,
    });
  }

  let vite: ViteDevServer | undefined;
  let registryPath: string | undefined;
  const closedBarrier = createClosedBarrier();
  let shuttingDown = false;
  let inactivityTimer: ReturnType<typeof setTimeout> | undefined;
  const mediaRoots = [workspaceRoot, specDir];
  // Parsing draws every Mermaid diagram, so page loads reuse it until the page changes, as Vite cached its module.
  const documentCache: DocumentCache = new Map(
    parsed.map((page) => [
      page.file,
      { source: page.source, body: documentBody(page, page.document) },
    ]),
  );
  const reloadClients = new Set<Duplex>();
  // As with Vite's HMR token, only a page this server sent can open the reload socket from a browser.
  const reloadToken = randomBytes(16).toString("base64url");
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let watcher: FSWatcher | undefined;
  let outline = pageOutline(read.spec.pages);
  const changedPages = new Set<string>();
  const sendReload = async () => {
    const files = [...changedPages];
    changedPages.clear();
    let messages = files;
    const next = await readSpec(filePath);
    const nextOutline =
      next instanceof Error ? next.message : pageOutline(next.spec.pages);
    if (nextOutline !== outline) {
      outline = nextOutline;
      messages = ["pages"];
    }
    for (const message of messages) {
      for (const client of reloadClients) client.write(textFrame(message));
    }
  };
  try {
    // Watch the directory: editors often save by replacing the file, which ends a watch on the file itself.
    watcher = watch(specDir, (_event, name) => {
      if (name === null || !isMarkdownFile(name)) return;
      changedPages.add(name);
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        // oxlint-disable-next-line typescript/no-floating-promises -- Timer callbacks cannot await; sendReload handles its own errors.
        void sendReload();
      }, 50);
    });
    watcher.on("error", noop);
  } catch {
    // Without a watcher (for example, out of inotify watches) the page still works; it just does not reload on edits, as with Vite.
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch(() => {
      // Connect, under Vite, answered a throwing request with 500 and kept serving.
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    });
  });
  // Live reload rides a WebSocket, as Vite's did. An EventSource would hold one of the browser's six HTTP/1.1 connections per tab.
  server.on("upgrade", (req: http.IncomingMessage, socket: Duplex) => {
    const requestUrl = parseRequestUrl(req.url);
    if (requestUrl?.pathname !== "/__diffmap/events") {
      // Vite's own listener answers its HMR socket in DIFFMAP_DEV.
      if (vite === undefined) socket.destroy();
      return;
    }
    const key = req.headers["sec-websocket-key"];
    if (
      !isAllowedHost(req.headers.host) ||
      typeof key !== "string" ||
      (req.headers.origin !== undefined &&
        requestUrl.searchParams.get("token") !== reloadToken)
    ) {
      socket.destroy();
      return;
    }
    const accept = createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    reloadClients.add(socket);
    socket.on("data", (frame: Buffer) => {
      // The page only ever sends a close frame (opcode 8) when it unloads.
      if (((frame[0] ?? 0) & 0x0f) === 8) socket.end();
    });
    socket.on("error", noop);
    socket.once("close", () => reloadClients.delete(socket));
  });

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    clearTimeout(inactivityTimer);
    clearTimeout(reloadTimer);
    watcher?.close();
    for (const client of reloadClients) client.destroy();
    if (vite !== undefined) await vite.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
    if (registryPath !== undefined) {
      const removed = await unregisterRunningDiffmap(registryPath);
      if (removed instanceof Error) console.error(removed.message);
    }
    closedBarrier.resolve();
  }

  async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    // Same DNS rebinding guard as Vite's dev server: a page on another site cannot reach this one through its own host name.
    if (!isAllowedHost(req.headers.host)) {
      res.statusCode = 403;
      res.setHeader("content-type", "text/plain");
      res.end(
        `Blocked request. This host (${req.headers.host}) is not allowed.`,
      );
      return;
    }
    // Only the viewer page runs script (sendIndex allows its own); a repo file served as a page, such as an SVG, runs none.
    res.setHeader("content-security-policy", contentSecurityPolicy("'none'"));
    const url = req.url ?? "/";
    const requestUrl = new URL(url, "http://127.0.0.1");
    const pathname = requestUrl.pathname;
    const get = req.method === "GET" || req.method === "HEAD";
    if (
      req.method === "GET" &&
      (pathname === "/" ||
        pathname === "/__diffmap/document" ||
        pathname === "/__diffmap/file" ||
        pathname === "/__diffmap/definition" ||
        pathname === "/__diffmap/source" ||
        pathname === "/__diffmap/changes" ||
        pathname === "/__diffmap/deltas")
    ) {
      inactivityTimer?.refresh();
    }
    if (
      req.method === "GET" &&
      !pathname.startsWith("/__diffmap") &&
      acceptsMarkdown(req.headers.accept)
    ) {
      await serveMarkdown({ filePath, page: pageSegment(pathname), res });
      return;
    }
    if (req.method === "GET" && pathname === "/__diffmap/spec") {
      await serveSpec({ filePath, res });
      return;
    }
    if (req.method === "GET" && pathname === "/__diffmap/document") {
      await serveDocument({
        filePath,
        page: requestUrl.searchParams.get("page") ?? "",
        cache: documentCache,
        res,
      });
      return;
    }
    if (req.method === "POST" && pathname === "/__diffmap/telemetry") {
      // A JSON body needs a CORS preflight, which this server never grants, so only the viewer page can post here.
      const event = req.headers["content-type"]?.startsWith("application/json")
        ? await readViewerEvent(req)
        : undefined;
      if (event !== undefined) input.onViewerEvent?.(event);
      res.statusCode = 204;
      res.end();
      return;
    }
    if (get && pathname === "/__diffmap/media") {
      const resolved = path.resolve(
        specDir,
        requestUrl.searchParams.get("path") ?? "",
      );
      if (!isServableMedia(resolved, mediaRoots)) {
        res.statusCode = 403;
        res.setHeader("content-type", "text/plain");
        res.end("Restricted");
        return;
      }
      await sendFile(req, res, resolved);
      return;
    }
    if (pathname.startsWith("/__diffmap")) {
      await handleDiffmapRequest({
        url,
        method: req.method === undefined ? "GET" : req.method,
        workspaceRoot,
        title,
        filePath,
        shutdown,
        res,
      });
      return;
    }
    if (vite !== undefined) {
      const devServer = vite;
      devServer.middlewares(req, res, () => {
        // oxlint-disable-next-line typescript/no-floating-promises -- Connect middleware callbacks cannot await response handling.
        void fs
          .readFile(path.join(packageRoot, "index.html"), "utf8")
          .then((html) => devServer.transformIndexHtml(url, html))
          .then((html) => sendIndex(res, html, title, reloadToken));
      });
      return;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      // Vite answered a malformed escape such as `/%E0%A4%A` with 404.
      res.statusCode = 404;
      res.end();
      return;
    }
    const asset = path.join(viewerDist, path.normalize(decoded));
    if (
      get &&
      pathname !== "/" &&
      pathname !== "/index.html" &&
      asset.startsWith(viewerDist + path.sep) &&
      (await isFile(asset))
    ) {
      await sendFile(req, res, asset, {
        // Vite puts a content hash in every file name under assets/.
        "cache-control": pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      return;
    }
    sendIndex(
      res,
      await fs.readFile(path.join(viewerDist, "index.html"), "utf8"),
      title,
      reloadToken,
    );
  }

  if (dev) {
    const { createServer } = await import("vite");
    vite = await createServer({
      configFile: path.join(packageRoot, "vite.config.ts"),
      root: packageRoot,
      appType: "custom",
      server: { middlewareMode: true, ws: { server } },
    });
  }

  const listened = await new Promise<Error | undefined>((resolve) => {
    server.once("error", (cause: NodeJS.ErrnoException) => {
      resolve(
        new DiffmapServeError({
          reason:
            cause.code === "EADDRINUSE"
              ? `Port ${port} is already in use`
              : cause.message,
        }),
      );
    });
    server.listen(port, "127.0.0.1", () => resolve(undefined));
  });
  if (listened instanceof Error) {
    await shutdown();
    return listened;
  }
  const address = server.address();
  if (address === null || typeof address === "string") {
    await shutdown();
    return new DiffmapServeError({ reason: "no listen url" });
  }
  const url = `http://127.0.0.1:${address.port}`;
  const registered = await registerRunningDiffmap({
    pid: process.pid,
    title,
    url,
    file: filePath,
  });
  if (registered instanceof Error) {
    await shutdown();
    return registered;
  }
  registryPath = registered;
  inactivityTimer = setTimeout(
    () => {
      // oxlint-disable-next-line typescript/no-floating-promises -- Timer callbacks cannot await shutdown.
      void shutdown();
    },
    24 * 60 * 60 * 1_000,
  );

  process.once("SIGINT", () => {
    // oxlint-disable-next-line typescript/no-floating-promises -- Process signal callbacks cannot await shutdown.
    void shutdown();
  });
  process.once("SIGTERM", () => {
    // oxlint-disable-next-line typescript/no-floating-promises -- Process signal callbacks cannot await shutdown.
    void shutdown();
  });

  return {
    url,
    filePath,
    warnings,
    documents: parsed.map((page) => page.document),
    shutdown,
    closed: closedBarrier.closed,
  };
}

/** The event in a `{ "event": …, …properties }` body, or undefined unless it matches viewerEventSchema. */
async function readViewerEvent(req: http.IncomingMessage) {
  let body = "";
  for await (const chunk of req) {
    body += String(chunk);
    if (body.length > 1_000) return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const { event, ...sent } = value as Record<string, unknown>;
  if (typeof event !== "string" || !Object.hasOwn(viewerEventSchema, event))
    return undefined;
  const allowed: Record<string, readonly string[]> =
    viewerEventSchema[event as keyof ViewerEventSchema];
  const properties: Record<string, string> = {};
  for (const [name, values] of Object.entries(allowed)) {
    const sentValue = sent[name];
    if (typeof sentValue !== "string" || !values.includes(sentValue))
      return undefined;
    properties[name] = sentValue;
  }
  // SAFETY: the event is a schema key, and each of its properties holds one of the schema's values.
  return { event, ...properties } as ViewerEvent;
}

function isAllowedHost(host: string | undefined) {
  if (host === undefined) return true;
  const trimmed = host.trim();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end > 0 && net.isIP(trimmed.slice(1, end)) === 6;
  }
  const hostname = trimmed.split(":", 1)[0] ?? "";
  if (net.isIP(hostname) === 4) return true;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  // Amp sets this to an orb's portal host name, as it does for any Vite server.
  // oxlint-disable-next-line no-underscore-dangle -- Vite's variable name, which Amp sets.
  const extra = process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS ?? "";
  return extra
    .split(",")
    .map((entry) => entry.trim())
    .some(
      (entry) =>
        entry === hostname ||
        (entry.startsWith(".") &&
          (entry.slice(1) === hostname || hostname.endsWith(entry))),
    );
}

/** The files Vite's dev server refused to serve, so a spec cannot embed secrets next to it. */
function isServableMedia(file: string, roots: string[]) {
  const inRoot = roots.some(
    (root) => file === root || file.startsWith(root + path.sep),
  );
  if (!inRoot) return false;
  const windows = process.platform === "win32";
  // A `:` names a Windows alternate data stream, and a short name such as ENV~1 is another name for a denied file.
  if ((windows ? file.replace(/^[a-z]:/i, "") : file).includes(":"))
    return false;
  // Vite matched its deny list case-insensitively, which matters on macOS and Windows file systems.
  const segments = file.toLowerCase().split(path.sep);
  if (
    windows &&
    segments.some((segment) =>
      /^[^~.]{1,6}~\d+(?:\.[^~.]{0,3})?$/.test(segment),
    )
  )
    return false;
  const name = segments.at(-1) ?? "";
  return !(
    name === ".env" ||
    name.startsWith(".env.") ||
    name === ".npmrc" ||
    name === ".yarnrc.yml" ||
    /\.(crt|pem|key|p12|pfx|cer|der)$/.test(name) ||
    segments.includes(".git")
  );
}

async function isFile(file: string) {
  const stat = await fs.stat(file).catch(() => undefined);
  return stat?.isFile() === true;
}

const contentTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".ogv": "video/ogg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

/** Sends a file, answering a single `Range` request with 206 so videos can seek. */
async function sendFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  file: string,
  headers: Record<string, string> = {},
) {
  const stat = await fs.stat(file).catch(() => undefined);
  if (stat === undefined || !stat.isFile()) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const size = stat.size;
  let start = 0;
  let end = size - 1;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range !== null && (range[1] !== "" || range[2] !== "")) {
    if (range[1] === "") {
      start = Math.max(0, size - Number(range[2]));
    } else {
      start = Number(range[1]);
      if (range[2] !== "") end = Math.min(Number(range[2]), size - 1);
    }
    if (start > end) {
      res.writeHead(416, { "content-range": `bytes */${size}` });
      res.end();
      return;
    }
    res.statusCode = 206;
    res.setHeader("content-range", `bytes ${start}-${end}/${size}`);
  } else {
    res.statusCode = 200;
  }
  res.setHeader(
    "content-type",
    contentTypes[path.extname(file).toLowerCase()] ??
      "application/octet-stream",
  );
  res.setHeader("content-length", String(end - start + 1));
  res.setHeader("accept-ranges", "bytes");
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }
  if (req.method === "HEAD" || size === 0) {
    res.end();
    return;
  }
  // An unreadable file ends this response instead of crashing the server.
  pipeline(createReadStream(file, { start, end }), res, noop);
}

function sendIndex(
  res: http.ServerResponse,
  html: string,
  title: string,
  reloadToken: string,
) {
  const nonce = randomBytes(16).toString("base64");
  res.statusCode = 200;
  res.setHeader("content-type", "text/html");
  res.setHeader("cache-control", "no-cache");
  // A spec's HTML is not trusted: only the viewer's own scripts carry the nonce, and 'strict-dynamic' extends it to the code they load, so inline handlers and injected scripts never run.
  res.setHeader(
    "content-security-policy",
    contentSecurityPolicy(
      `'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'`,
    ),
  );
  res.end(
    html
      .replaceAll(
        "<title>diffmap</title>",
        `<title>${escapeHtml(title)}</title>`,
      )
      .replaceAll(/<(script|link rel="modulepreload")/g, `<$1 nonce="${nonce}"`)
      .replace(
        "</head>",
        // Vite's preload helper reads the nonce from this tag for the modules it preloads.
        `<meta name="diffmap-reload-token" content="${reloadToken}" />\n  <meta property="csp-nonce" nonce="${nonce}" />\n  </head>`,
      ),
  );
}

function contentSecurityPolicy(scriptSources: string) {
  return `script-src ${scriptSources}; object-src 'none'; base-uri 'none'`;
}

/** A request's URL, or undefined for one the URL parser rejects, such as `//`. */
function parseRequestUrl(url: string | undefined) {
  try {
    return new URL(url ?? "/", "http://127.0.0.1");
  } catch {
    return undefined;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type DocumentCache = Map<string, { source: string; body: string }>;

/** A page's document, or its parse error. Both name the page, so the viewer knows which file to reload on. */
function documentBody(page: SpecPage, document: unknown) {
  return JSON.stringify({
    page: { file: page.file, slug: page.slug, title: page.title },
    ...(document instanceof Error
      ? { parseError: document.message }
      : { viewerDocument: document }),
  });
}

/** The page a request path names: `/` is the cover, `/<slug>` a page. */
function pageSegment(pathname: string) {
  try {
    return decodeURIComponent(pathname).replace(/^\/+|\/+$/g, "");
  } catch {
    return pathname;
  }
}

async function readPage(filePath: string, segment: string) {
  const read = await readSpec(filePath);
  if (read instanceof Error) return read;
  const page = findPage(read.spec, segment);
  if (page === undefined) {
    return new DiffmapServeError({
      reason: `this spec has no page "${segment}"`,
    });
  }
  return page;
}

async function serveSpec(input: { filePath: string; res: DiffmapResponse }) {
  const read = await readSpec(input.filePath);
  sendJson(
    input.res,
    JSON.stringify(
      read instanceof Error
        ? { error: read.message }
        : {
            title: read.spec.title,
            pages: read.spec.pages.map((page) => ({
              file: page.file,
              slug: page.slug,
              title: page.title,
            })),
          },
    ),
  );
}

async function serveDocument(input: {
  filePath: string;
  page: string;
  cache: DocumentCache;
  res: DiffmapResponse;
}) {
  const page = await readPage(input.filePath, input.page);
  if (page instanceof Error) {
    sendJson(input.res, JSON.stringify({ parseError: page.message }));
    return;
  }
  let cached = input.cache.get(page.file);
  if (cached?.source !== page.source) {
    cached = {
      source: page.source,
      body: documentBody(page, parseViewerDocument(page.source, page.path)),
    };
    input.cache.set(page.file, cached);
  }
  sendJson(input.res, cached.body);
}

function sendJson(res: DiffmapResponse, body: string) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(body);
}

type DiffmapResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk: string) => void;
};

function acceptsMarkdown(accept: string | undefined) {
  if (accept === undefined) return false;
  return accept
    .split(",")
    .some(
      (mediaRange) =>
        mediaRange.trim().split(";", 1)[0]?.trim() === "text/markdown",
    );
}

async function serveMarkdown(input: {
  filePath: string;
  page: string;
  res: DiffmapResponse;
}) {
  const page = await readPage(input.filePath, input.page);
  if (page instanceof Error) {
    input.res.statusCode = page instanceof DiffmapServeError ? 404 : 500;
    input.res.setHeader("content-type", "text/plain; charset=utf-8");
    input.res.end(page.message);
    return;
  }
  input.res.statusCode = 200;
  input.res.setHeader("content-type", "text/markdown; charset=utf-8");
  input.res.setHeader("vary", "Accept");
  input.res.end(page.source);
}

async function handleDiffmapRequest(input: {
  url: string;
  method: string;
  workspaceRoot: string;
  title: string;
  filePath: string;
  shutdown: () => Promise<void>;
  res: DiffmapResponse;
}) {
  const parsed = new URL(input.url, "http://127.0.0.1");
  if (
    (parsed.pathname === "/__diffmap/definition" ||
      parsed.pathname === "/__diffmap/source") &&
    input.method === "GET"
  ) {
    // The TypeScript compiler loads with the first lookup instead of at startup.
    const { findDefinition, readSourceReference } =
      await import("./definitions.js");
    const definition =
      parsed.pathname === "/__diffmap/source"
        ? readSourceReference(input.workspaceRoot, parsed.searchParams)
        : findDefinition(input.workspaceRoot, parsed.searchParams);
    input.res.statusCode = definition instanceof Error ? 400 : 200;
    input.res.setHeader("content-type", "application/json; charset=utf-8");
    input.res.end(
      JSON.stringify(
        definition instanceof Error
          ? { error: definition.message }
          : { definition },
      ),
    );
    return;
  }
  if (parsed.pathname === "/__diffmap/changes" && input.method === "GET") {
    const changes = await readChanges(
      input.workspaceRoot,
      parsed.searchParams.get("rev") ?? "",
    );
    input.res.statusCode = changes instanceof Error ? 400 : 200;
    input.res.setHeader("content-type", "application/json; charset=utf-8");
    input.res.end(
      JSON.stringify(
        changes instanceof Error ? { error: changes.message } : { changes },
      ),
    );
    return;
  }
  if (parsed.pathname === "/__diffmap/deltas" && input.method === "GET") {
    const deltas = await listDeltas(
      input.workspaceRoot,
      parsed.searchParams.get("rev") ?? undefined,
    );
    input.res.statusCode = deltas instanceof Error ? 400 : 200;
    input.res.setHeader("content-type", "application/json; charset=utf-8");
    input.res.end(
      JSON.stringify(
        deltas instanceof Error ? { error: deltas.message } : { deltas },
      ),
    );
    return;
  }
  if (parsed.pathname === "/__diffmap/shutdown" && input.method === "POST") {
    input.res.statusCode = 200;
    input.res.setHeader("content-type", "text/plain; charset=utf-8");
    input.res.end("ok");
    setTimeout(() => {
      // oxlint-disable-next-line typescript/no-floating-promises -- The response must finish before the delayed shutdown begins.
      void input.shutdown();
    }, 250);
    return;
  }
  if (parsed.pathname === "/__diffmap/meta" && input.method === "GET") {
    const read = await readSpec(input.filePath);
    const title = read instanceof Error ? input.title : read.spec.title;
    input.res.statusCode = 200;
    input.res.setHeader("content-type", "application/json; charset=utf-8");
    input.res.end(
      JSON.stringify({
        title,
        file: input.filePath,
        pid: process.pid,
      }),
    );
    return;
  }
  if (parsed.pathname === "/__diffmap/file" && input.method === "GET") {
    const excerpt = await readWorkspaceExcerpt({
      workspaceRoot: input.workspaceRoot,
      requestedPath: parsed.searchParams.get("path"),
      start: parsed.searchParams.get("start"),
      end: parsed.searchParams.get("end"),
    });
    if (excerpt instanceof Error) {
      input.res.statusCode = 400;
      input.res.setHeader("content-type", "application/json; charset=utf-8");
      input.res.end(JSON.stringify({ error: excerpt.message }));
      return;
    }
    input.res.statusCode = 200;
    input.res.setHeader("content-type", "application/json; charset=utf-8");
    input.res.end(JSON.stringify(excerpt));
    return;
  }
  input.res.statusCode = 404;
  input.res.end("not found");
}

export type FileExcerpt = {
  path: string;
  start: number;
  end: number;
  contents: string;
};

async function readWorkspaceExcerpt(input: {
  workspaceRoot: string;
  requestedPath: string | null;
  start: string | null;
  end: string | null;
}) {
  if (input.requestedPath === null || input.requestedPath.length === 0) {
    return new DiffmapFileError({
      path: "",
      reason: "missing path",
    });
  }
  const requestedPath = input.requestedPath;
  const resolvedRoot = path.resolve(input.workspaceRoot);
  const resolved = path.resolve(resolvedRoot, requestedPath);
  const prefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;
  if (resolved !== resolvedRoot && !resolved.startsWith(prefix)) {
    return new DiffmapFileError({
      path: requestedPath,
      reason: "path escapes workspace",
    });
  }
  const contents = await fs.readFile(resolved, "utf8").catch(
    (cause) =>
      new DiffmapFileError({
        path: requestedPath,
        reason: "read",
        cause,
      }),
  );
  if (contents instanceof Error) return contents;
  const lines = contents.split("\n");
  const start = parseLine(input.start, 1);
  const end = parseLine(input.end, lines.length);
  return {
    path: requestedPath,
    start,
    end,
    contents: lines.slice(start - 1, end).join("\n"),
  };
}

function parseLine(value: string | null, fallback: number) {
  if (value === null || value.length === 0) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}
