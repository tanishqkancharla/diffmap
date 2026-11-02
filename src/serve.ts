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
import { extractTitle } from "./extractDocument.js";
import { parseViewerDocument } from "./parseViewer.js";
import { findDefinition, readSourceReference } from "./definitions.js";
import { listDeltas, readChanges, readDocumentChanges } from "./git.js";
import {
  registerRunningDiffmap,
  unregisterRunningDiffmap,
} from "./registry.js";

export type DiffmapServer = {
  url: string;
  filePath: string;
  shutdown: () => Promise<void>;
  closed: Promise<void>;
};

export type StartServerInput = {
  filePath: string;
  workspaceRoot: string;
  port?: number;
};

const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
/** Written by `npm run build:viewer`; published with the package. */
const viewerDist = path.join(packageRoot, "viewer-dist");

function noop() {}

const RELOAD_FRAME = Buffer.from([0x81, 6, ...Buffer.from("change")]);

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
  const source = await fs.readFile(filePath, "utf8").catch(
    (cause) =>
      new DiffmapFileError({
        path: filePath,
        reason: "read",
        cause,
      }),
  );
  if (source instanceof Error) return source;

  const parsed = parseViewerDocument(source, filePath);
  if (parsed instanceof Error) return parsed;
  const changes = await readDocumentChanges(workspaceRoot, parsed);
  if (changes instanceof Error) return changes;

  const title = extractTitle(source);
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
  const mediaRoots = [workspaceRoot, path.dirname(filePath)];
  // Parsing draws every Mermaid diagram, so page loads reuse it until the spec changes, as Vite cached its module.
  const documentCache = {
    source,
    body: JSON.stringify({ viewerDocument: parsed }),
  };
  const reloadClients = new Set<Duplex>();
  // As with Vite's HMR token, only a page this server sent can open the reload socket from a browser.
  const reloadToken = randomBytes(16).toString("base64url");
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let watcher: FSWatcher | undefined;
  try {
    // Watch the directory: editors often save by replacing the file, which ends a watch on the file itself.
    watcher = watch(path.dirname(filePath), (_event, name) => {
      if (name !== path.basename(filePath)) return;
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        for (const client of reloadClients) client.write(RELOAD_FRAME);
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
    const url = req.url ?? "/";
    const requestUrl = new URL(url, "http://127.0.0.1");
    const pathname = requestUrl.pathname;
    const get = req.method === "GET" || req.method === "HEAD";
    if (
      req.method === "GET" &&
      (pathname === "/" ||
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
      pathname === "/" &&
      acceptsMarkdown(req.headers.accept)
    ) {
      await serveMarkdown({ filePath, res });
      return;
    }
    if (req.method === "GET" && pathname === "/__diffmap/document") {
      await serveDocument({ filePath, cache: documentCache, res });
      return;
    }
    if (get && pathname === "/__diffmap/media") {
      const resolved = path.resolve(
        path.dirname(filePath),
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
    shutdown,
    closed: closedBarrier.closed,
  };
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
  res.statusCode = 200;
  res.setHeader("content-type", "text/html");
  res.setHeader("cache-control", "no-cache");
  res.end(
    html
      .replaceAll(
        "<title>diffmap</title>",
        `<title>${escapeHtml(title)}</title>`,
      )
      .replace(
        "</head>",
        `<meta name="diffmap-reload-token" content="${reloadToken}" />\n  </head>`,
      ),
  );
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

async function serveDocument(input: {
  filePath: string;
  cache: { source: string; body: string };
  res: DiffmapResponse;
}) {
  const source = await fs.readFile(input.filePath, "utf8").catch(
    (cause) =>
      new DiffmapFileError({
        path: input.filePath,
        reason: "read",
        cause,
      }),
  );
  if (source instanceof Error) {
    sendJson(input.res, JSON.stringify({ parseError: source.message }));
    return;
  }
  if (source !== input.cache.source) {
    const document = parseViewerDocument(source, input.filePath);
    input.cache.source = source;
    input.cache.body = JSON.stringify(
      document instanceof Error
        ? { parseError: document.message }
        : { viewerDocument: document },
    );
  }
  sendJson(input.res, input.cache.body);
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
  res: DiffmapResponse;
}) {
  const source = await fs.readFile(input.filePath, "utf8").catch(
    (cause) =>
      new DiffmapFileError({
        path: input.filePath,
        reason: "read",
        cause,
      }),
  );
  if (source instanceof Error) {
    input.res.statusCode = 500;
    input.res.setHeader("content-type", "text/plain; charset=utf-8");
    input.res.end(source.message);
    return;
  }
  input.res.statusCode = 200;
  input.res.setHeader("content-type", "text/markdown; charset=utf-8");
  input.res.setHeader("vary", "Accept");
  input.res.end(source);
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
    const source = await fs
      .readFile(input.filePath, "utf8")
      .catch(() => undefined);
    const title = source === undefined ? input.title : extractTitle(source);
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
