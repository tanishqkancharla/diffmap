import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { diffmapContentPlugin } from "./contentPlugin.js";
import { DiffmapFileError, DiffmapServeError } from "./errors.js";
import { extractTitle } from "./extractDocument.js";
import { parseViewerDocument } from "./parseViewer.js";
import { findDefinition, readSourceReference } from "./definitions.js";
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
  port: number;
};

const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function noop() {}

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

  const title = extractTitle(source);

  let vite: ViteDevServer | undefined;
  let registryPath: string | undefined;
  const closedBarrier = createClosedBarrier();
  let shuttingDown = false;
  let inactivityTimer: ReturnType<typeof setTimeout> | undefined;

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    clearTimeout(inactivityTimer);
    if (vite !== undefined) await vite.close();
    if (registryPath !== undefined) {
      const removed = await unregisterRunningDiffmap(registryPath);
      if (removed instanceof Error) console.error(removed.message);
    }
    closedBarrier.resolve();
  }

  vite = await createServer({
    configFile: path.join(packageRoot, "vite.config.ts"),
    root: packageRoot,
    server: {
      port: input.port,
      host: "127.0.0.1",
      strictPort: input.port !== 0,
      fs: {
        allow: [packageRoot, workspaceRoot, path.dirname(filePath)],
      },
    },
    plugins: [
      diffmapContentPlugin({ filePath, title }),
      {
        name: "diffmap-api",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url;
            const pathname =
              url === undefined
                ? undefined
                : new URL(url, "http://127.0.0.1").pathname;
            if (
              req.method === "GET" &&
              (pathname === "/" ||
                pathname === "/__diffmap/file" ||
                pathname === "/__diffmap/definition" ||
                pathname === "/__diffmap/source")
            ) {
              inactivityTimer?.refresh();
            }
            if (
              req.method === "GET" &&
              pathname === "/" &&
              acceptsMarkdown(req.headers.accept)
            ) {
              // oxlint-disable-next-line typescript/no-floating-promises -- Connect middleware callbacks cannot await response handling.
              void serveMarkdown({ filePath, res });
              return;
            }
            if (url === undefined || !url.startsWith("/__diffmap")) {
              next();
              return;
            }
            // oxlint-disable-next-line typescript/no-floating-promises -- Connect middleware callbacks cannot await response handling.
            void handleDiffmapRequest({
              url,
              method: req.method === undefined ? "GET" : req.method,
              workspaceRoot,
              title,
              filePath,
              shutdown,
              res,
            });
          });
        },
      },
    ],
  });

  await vite.listen(input.port);
  const localUrl = vite.resolvedUrls?.local[0];
  if (localUrl === undefined) {
    await shutdown();
    return new DiffmapServeError({ reason: "no listen url" });
  }
  const url = localUrl.replace(/\/$/, "");
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
