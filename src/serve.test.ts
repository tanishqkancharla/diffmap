import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { DiffmapServeError } from "./errors.js";
import { startServer, type DiffmapServer } from "./serve.js";

const execFileAsync = promisify(execFile);
const srcDir = fileURLToPath(new URL(".", import.meta.url));
const packageRoot = path.resolve(srcDir, "..");
const cliPath = path.join(srcDir, "cli.ts");
const sampleSpec = path.join(packageRoot, "fixtures", "sample-spec.md");
const localUrlPattern = /http:\/\/127\.0\.0\.1:\d+/g;

function httpUrlPort(url: string) {
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "127.0.0.1");
  const port = Number(parsed.port);
  assert.ok(Number.isInteger(port) && port > 0);
  return port;
}

function assertStarted(
  started: Awaited<ReturnType<typeof startServer>>,
): DiffmapServer {
  assert.equal(
    started instanceof Error,
    false,
    started instanceof Error ? started.message : "",
  );
  if (started instanceof Error) throw started;
  return started;
}

async function occupyPort(port: number) {
  const server = net.createServer();
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => resolve());
    });
    return server;
  } catch {
    server.close();
    return undefined;
  }
}

async function listenEphemeral() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  return server;
}

function boundPort(server: net.Server) {
  const address = server.address();
  assert.ok(address !== null && typeof address !== "string");
  return address.port;
}

async function closeTcp(server: net.Server | undefined) {
  if (server === undefined) return;
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

async function fetchOk(url: string) {
  const response = await fetch(url, {
    headers: { accept: "text/markdown" },
  });
  assert.equal(response.ok, true);
  const body = await response.text();
  assert.match(body, /Spec fixture/);
}

async function waitForClosed(server: DiffmapServer, timeoutMs = 10_000) {
  await Promise.race([
    server.closed,
    delay(timeoutMs).then(() => {
      throw new Error(`server did not close: ${server.url}`);
    }),
  ]);
}

test(
  "startServer binds distinct free ports when 4177 is taken",
  { timeout: 90_000 },
  async () => {
    const occupied = await occupyPort(4177);
    try {
      const first = assertStarted(
        await startServer({
          filePath: sampleSpec,
          workspaceRoot: packageRoot,
        }),
      );
      const second = assertStarted(
        await startServer({
          filePath: sampleSpec,
          workspaceRoot: packageRoot,
        }),
      );
      try {
        const firstPort = httpUrlPort(first.url);
        const secondPort = httpUrlPort(second.url);
        assert.notEqual(firstPort, secondPort);
        assert.notEqual(firstPort, 4177);
        assert.notEqual(secondPort, 4177);
        await fetchOk(first.url);
        await fetchOk(second.url);
      } finally {
        await first.shutdown();
        await second.shutdown();
        await waitForClosed(first);
        await waitForClosed(second);
      }
    } finally {
      await closeTcp(occupied);
    }
  },
);

test(
  "startServer --port pins and fails when that port is taken",
  { timeout: 90_000 },
  async () => {
    const holder = await listenEphemeral();
    const port = boundPort(holder);

    const blocked = await startServer({
      filePath: sampleSpec,
      workspaceRoot: packageRoot,
      port,
    });
    assert.equal(blocked instanceof DiffmapServeError, true);
    if (!(blocked instanceof DiffmapServeError)) return;
    assert.match(blocked.message, /already in use/i);

    await closeTcp(holder);

    const pinned = assertStarted(
      await startServer({
        filePath: sampleSpec,
        workspaceRoot: packageRoot,
        port,
      }),
    );
    try {
      assert.equal(httpUrlPort(pinned.url), port);
      await fetchOk(pinned.url);
    } finally {
      await pinned.shutdown();
      await waitForClosed(pinned);
    }
  },
);

test(
  "startServer Close server still stops an ephemeral listener",
  { timeout: 90_000 },
  async () => {
    const started = assertStarted(
      await startServer({
        filePath: sampleSpec,
        workspaceRoot: packageRoot,
      }),
    );
    const response = await fetch(`${started.url}/__diffmap/shutdown`, {
      method: "POST",
    });
    assert.equal(response.ok, true);
    await waitForClosed(started);
    await assert.rejects(() => fetch(started.url));
  },
);

type SpawnedCli = {
  child: ChildProcess;
  output: () => string;
};

function spawnCli(args: string[]) {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, ["--import", "tsx", cliPath, ...args], {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  return {
    child,
    output: () => `${stdout}${stderr}`,
  };
}

function firstLocalUrl(text: string) {
  return text.match(localUrlPattern)?.[0];
}

async function waitForLocalUrl(spawned: SpawnedCli, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (spawned.child.exitCode !== null) {
      throw new Error(
        `cli exited ${spawned.child.exitCode} before listen:\n${spawned.output()}`,
      );
    }
    const url = firstLocalUrl(spawned.output());
    if (url !== undefined) return url;
    await delay(50);
  }
  throw new Error(`cli printed no listen url:\n${spawned.output()}`);
}

async function waitForExit(child: ChildProcess, timeoutMs = 15_000) {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    }),
    delay(timeoutMs).then(() => {
      child.kill("SIGKILL");
      throw new Error("cli did not exit");
    }),
  ]);
}

async function stopCli(spawned: SpawnedCli, url: string) {
  const response = await fetch(`${url}/__diffmap/shutdown`, {
    method: "POST",
  }).catch(() => undefined);
  if (response === undefined || !response.ok) {
    spawned.child.kill("SIGTERM");
  }
  await waitForExit(spawned.child);
}

async function withTempSpecs(
  run: (firstFile: string, secondFile: string) => Promise<void>,
) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-serve-"));
  const firstFile = path.join(dir, "one.md");
  const secondFile = path.join(dir, "two.md");
  const source = await fs.readFile(sampleSpec, "utf8");
  await Promise.all([
    fs.writeFile(firstFile, source),
    fs.writeFile(secondFile, source),
  ]);
  try {
    await run(firstFile, secondFile);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test(
  "diffmap serve prints a free port and list tracks both servers",
  { timeout: 90_000 },
  async () => {
    await withTempSpecs(async (firstFile, secondFile) => {
      const first = spawnCli(["serve", firstFile]);
      const second = spawnCli([secondFile]);
      try {
        const firstUrl = await waitForLocalUrl(first);
        const secondUrl = await waitForLocalUrl(second);
        assert.notEqual(firstUrl, secondUrl);
        await fetchOk(firstUrl);
        await fetchOk(secondUrl);

        const listed = await execFileAsync(
          process.execPath,
          ["--import", "tsx", cliPath, "list"],
          {
            cwd: packageRoot,
            timeout: 20_000,
            maxBuffer: 1_000_000,
          },
        );
        const listOutput = `${listed.stdout}${listed.stderr}`;
        assert.equal(listOutput.includes(firstUrl), true);
        assert.equal(listOutput.includes(secondUrl), true);

        await stopCli(first, firstUrl);
        await stopCli(second, secondUrl);
      } finally {
        first.child.kill("SIGTERM");
        second.child.kill("SIGTERM");
      }
    });
  },
);

test(
  "startServer serves media beside the spec, with ranges, and nothing outside it",
  { timeout: 30_000 },
  async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-media-"));
    const workspace = path.join(dir, "workspace");
    await fs.mkdir(workspace);
    const clip = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251));
    await Promise.all([
      fs.writeFile(path.join(workspace, "spec.md"), "# Media\n"),
      fs.writeFile(path.join(workspace, "clip.webm"), clip),
      fs.writeFile(path.join(workspace, ".env"), "SECRET=1\n"),
      fs.writeFile(path.join(dir, "outside.png"), "outside"),
    ]);
    const server = assertStarted(
      await startServer({
        filePath: path.join(workspace, "spec.md"),
        workspaceRoot: workspace,
      }),
    );
    const media = (src: string) =>
      `${server.url}/__diffmap/media?${new URLSearchParams({ path: src })}`;
    try {
      const whole = await fetch(media("clip.webm"));
      assert.equal(whole.status, 200);
      assert.equal(whole.headers.get("content-type"), "video/webm");
      assert.deepEqual(Buffer.from(await whole.arrayBuffer()), clip);

      const ranged = await fetch(media("clip.webm"), {
        headers: { range: "bytes=990-" },
      });
      assert.equal(ranged.status, 206);
      assert.equal(ranged.headers.get("content-range"), "bytes 990-999/1000");
      assert.deepEqual(
        Buffer.from(await ranged.arrayBuffer()),
        clip.subarray(990),
      );

      assert.equal((await fetch(media(".env"))).status, 403);
      // Denied names match in any case, since macOS and Windows open .env for .ENV.
      assert.equal((await fetch(media(".ENV"))).status, 403);
      assert.equal((await fetch(media("../outside.png"))).status, 403);
      assert.equal((await fetch(media("missing.png"))).status, 404);

      const rawStatus = (requestPath: string, host?: string) =>
        new Promise<number | undefined>((resolve) => {
          http
            .get(
              server.url,
              {
                path: requestPath,
                headers: host === undefined ? {} : { host },
              },
              (res) => {
                res.resume();
                resolve(res.statusCode);
              },
            )
            .on("error", () => resolve(undefined));
        });
      assert.equal(await rawStatus("/__diffmap/meta", "attacker.example"), 403);
      // A path the URL parser rejects fails that request only.
      assert.equal(await rawStatus("//"), 500);
      assert.equal(await rawStatus("/__diffmap/meta"), 200);
    } finally {
      await server.shutdown();
      await waitForClosed(server);
      await fs.rm(dir, { recursive: true, force: true });
    }
  },
);

test(
  "startServer tells the page to reload when the spec changes",
  { timeout: 30_000 },
  async () => {
    await withTempSpecs(async (file) => {
      const server = assertStarted(
        await startServer({ filePath: file, workspaceRoot: packageRoot }),
      );
      const socket = new WebSocket(
        `${server.url.replace("http", "ws")}/__diffmap/events`,
      );
      try {
        await new Promise((resolve, reject) => {
          socket.addEventListener("open", resolve, { once: true });
          socket.addEventListener("error", reject, { once: true });
        });
        // A browser sends Origin, so the page must carry the token the server put in its HTML.
        const upgrade = (query: string) =>
          new Promise<number | undefined>((resolve) => {
            http
              .get(`${server.url}/__diffmap/events${query}`, {
                headers: {
                  connection: "Upgrade",
                  upgrade: "websocket",
                  origin: "https://attacker.example",
                  "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
                  "sec-websocket-version": "13",
                },
              })
              .on("upgrade", (res, upgraded) => {
                upgraded.destroy();
                resolve(res.statusCode);
              })
              .on("error", () => resolve(undefined));
          });
        const page = await (await fetch(server.url)).text();
        const token = /name="diffmap-reload-token" content="([^"]+)"/.exec(
          page,
        )?.[1];
        assert.ok(token !== undefined);
        assert.equal(await upgrade(""), undefined);
        assert.equal(await upgrade(`?token=${token}`), 101);
        const message = new Promise<unknown>((resolve) => {
          socket.addEventListener("message", (event) => resolve(event.data), {
            once: true,
          });
        });
        // Save the way many editors do: write a new file and rename it over the spec.
        await fs.writeFile(`${file}.tmp`, "# Edited spec\n");
        await fs.rename(`${file}.tmp`, file);
        assert.equal(await message, "change");
        const document = (await (
          await fetch(`${server.url}/__diffmap/document`)
        ).json()) as { viewerDocument?: unknown };
        assert.match(JSON.stringify(document.viewerDocument), /Edited spec/);
      } finally {
        socket.close();
        await server.shutdown();
        await waitForClosed(server);
      }
    });
  },
);
