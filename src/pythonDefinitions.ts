import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { SourceDefinition } from "./definitions.js";
import { TkstackDefinitionError } from "./errors.js";

type Range = {
  start: { line: number; character: number };
  end: { line: number; character: number };
};
type Symbol = {
  name: string;
  range: Range;
  selectionRange: Range;
  children?: Symbol[];
};
type Location = { uri: string; range: Range };
type RpcMessage = {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message: string };
};
const servers = new Map<string, PythonServer>();

class PythonServer {
  private child;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private buffer = Buffer.alloc(0);
  private nextId = 0;
  private failure: Error | undefined;
  private opened = new Map<string, { contents: string; version: number }>();
  readonly ready: Promise<unknown>;
  constructor(readonly root: string) {
    const require = createRequire(import.meta.url);
    this.child = spawn(
      process.execPath,
      [require.resolve("pyright/langserver.index.js"), "--stdio"],
      { cwd: root, stdio: ["pipe", "pipe", "ignore"] },
    );
    this.child.stdout.on("data", (chunk: Buffer) => this.receive(chunk));
    const fail = (error: Error) => {
      this.failure = error;
      for (const item of this.pending.values()) {
        clearTimeout(item.timer);
        item.reject(error);
      }
      this.pending.clear();
      if (servers.get(root) === this) servers.delete(root);
    };
    this.child.on("error", fail);
    this.child.stdin.on("error", fail);
    this.child.on("exit", () =>
      fail(new Error("Python navigation stopped; try again.")),
    );
    this.ready = this.request("initialize", {
      processId: process.pid,
      rootUri: pathToFileURL(root).href,
      capabilities: {
        textDocument: {
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
        },
      },
      workspaceFolders: [
        { uri: pathToFileURL(root).href, name: path.basename(root) },
      ],
    })
      .then(() => {
        this.send({ method: "initialized", params: {} });
        this.send({
          method: "workspace/didChangeConfiguration",
          params: {
            settings: {
              python: {
                analysis: {
                  autoSearchPaths: true,
                  extraPaths: [path.join(root, "src")],
                  diagnosticMode: "openFilesOnly",
                },
              },
            },
          },
        });
      })
      .catch((error: unknown) => {
        this.stop();
        throw error;
      });
  }
  stop() {
    this.child.kill();
  }
  private send(message: RpcMessage) {
    const body = JSON.stringify({ jsonrpc: "2.0", ...message });
    this.child.stdin.write(
      `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
    );
  }
  private receive(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const boundary = this.buffer.indexOf("\r\n\r\n");
      if (boundary < 0) return;
      const length = Number(
        /Content-Length: (\d+)/i.exec(
          this.buffer.subarray(0, boundary).toString(),
        )?.[1],
      );
      if (!Number.isFinite(length)) {
        this.stop();
        return;
      }
      if (this.buffer.length < boundary + 4 + length) return;
      let message: RpcMessage;
      try {
        message = JSON.parse(
          this.buffer.subarray(boundary + 4, boundary + 4 + length).toString(),
        ) as RpcMessage;
      } catch {
        this.stop();
        return;
      }
      this.buffer = this.buffer.subarray(boundary + 4 + length);
      if (message.id === undefined) continue;
      if (message.method) {
        // oxlint-disable-next-line unicorn/no-null -- JSON-RPC requires an explicit null response.
        this.send({ id: message.id, result: null });
        continue;
      }
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    }
  }
  request(method: string, params: unknown): Promise<unknown> {
    if (this.failure) return Promise.reject(this.failure);
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error("Python navigation timed out. Try again after indexing."),
        );
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }
  async open(fileName: string, contents: string) {
    await this.ready;
    const uri = pathToFileURL(fileName).href;
    const previous = this.opened.get(uri);
    if (previous?.contents === contents) return uri;
    const version = (previous?.version ?? 0) + 1;
    this.send(
      previous
        ? {
            method: "textDocument/didChange",
            params: {
              textDocument: { uri, version },
              contentChanges: [{ text: contents }],
            },
          }
        : {
            method: "textDocument/didOpen",
            params: {
              textDocument: {
                uri,
                version,
                languageId: "python",
                text: contents,
              },
            },
          },
    );
    this.opened.set(uri, { contents, version });
    return uri;
  }
}

export function closePythonServers() {
  for (const server of servers.values()) server.stop();
  servers.clear();
}
process.once("exit", closePythonServers);

export async function pythonDefinition(
  root: string,
  fileName: string,
  contents: string,
  query: { symbol?: string; line?: number; column?: number },
): Promise<SourceDefinition | TkstackDefinitionError | undefined> {
  try {
    let server = servers.get(root);
    if (!server) {
      server = new PythonServer(root);
      servers.set(root, server);
    }
    const uri = await server.open(fileName, contents);
    const symbols = (await server.request("textDocument/documentSymbol", {
      textDocument: { uri },
    })) as Symbol[] | null;
    const flattened: { qualified: string; symbol: Symbol }[] = [];
    const walk = (nodes: Symbol[], parents: string[]) => {
      for (const symbol of nodes) {
        const names = [...parents, symbol.name];
        flattened.push({ qualified: names.join("."), symbol });
        walk(symbol.children ?? [], names);
      }
    };
    walk(symbols ?? [], []);
    if (query.symbol) {
      const matches = flattened.filter(
        (item) =>
          item.qualified === query.symbol ||
          item.qualified.endsWith(`.${query.symbol}`),
      );
      if (matches.length !== 1)
        return new TkstackDefinitionError({
          reason: matches.length
            ? `Ambiguous Python symbol: use ${matches.map((item) => item.qualified).join(", ")}.`
            : `Python symbol ${query.symbol} was not found.`,
        });
      const range = matches[0]!.symbol.range;
      return {
        path: path.relative(root, fileName),
        contents,
        start: range.start.line + 1,
        end: range.end.line + 1,
      };
    }
    const locations = (await server.request("textDocument/definition", {
      textDocument: { uri },
      position: { line: query.line! - 1, character: query.column },
    })) as Location[] | Location | null;
    if (
      Array.isArray(locations) &&
      new Set(
        locations.map(
          (location) =>
            `${location.uri}:${location.range.start.line}:${location.range.start.character}`,
        ),
      ).size > 1
    )
      return new TkstackDefinitionError({
        reason:
          "This Python call has multiple possible definitions. Open a qualified symbol reference to choose one.",
      });
    const location = Array.isArray(locations) ? locations[0] : locations;
    if (!location) return undefined;
    const target = fs.realpathSync(fileURLToPath(location.uri));
    const realRoot = fs.realpathSync(root);
    if (!target.startsWith(realRoot + path.sep))
      return new TkstackDefinitionError({
        reason:
          "This definition is in an external dependency, outside the selected workspace.",
      });
    const targetContents = fs.readFileSync(target, "utf8");
    const targetUri = await server.open(target, targetContents);
    const targetSymbols = (await server.request("textDocument/documentSymbol", {
      textDocument: { uri: targetUri },
    })) as Symbol[] | null;
    let range = location.range;
    const findRange = (nodes: Symbol[]) => {
      for (const symbol of nodes) {
        if (
          symbol.selectionRange.start.line === location.range.start.line &&
          symbol.selectionRange.start.character ===
            location.range.start.character
        )
          range = symbol.range;
        findRange(symbol.children ?? []);
      }
    };
    findRange(targetSymbols ?? []);
    return {
      path: path.relative(realRoot, target),
      contents: targetContents,
      start: range.start.line + 1,
      end: range.end.line + 1,
    };
  } catch (cause) {
    return new TkstackDefinitionError({
      reason: `Python navigation: ${cause instanceof Error ? cause.message : String(cause)}`,
    });
  }
}
