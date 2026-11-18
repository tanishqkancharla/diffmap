import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { parseManifest, type Manifest } from "../cloud/protocol.js";
import { secretReason } from "./secrets.js";
import { shareDocument, stopSharing } from "./share.js";

const execFileAsync = promisify(execFile);

test("secretReason flags keys and credential files, and passes ordinary code", () => {
  assert.match(
    secretReason("src/a.ts", 'const key = "AKIAABCDEFGHIJKLMNOP";') ?? "",
    /AWS/,
  );
  assert.match(
    secretReason("src/a.ts", "-----BEGIN RSA PRIVATE KEY-----\nabc") ?? "",
    /private key/,
  );
  assert.match(
    secretReason("src/a.ts", 'password: "correct-horse-battery"') ?? "",
    /password/,
  );
  assert.match(secretReason(".env.local", "PORT=3000") ?? "", /name/);
  assert.equal(
    secretReason("src/a.ts", "export const port = 3000;\n"),
    undefined,
  );
  assert.equal(
    secretReason("src/a.ts", 'const password = input.password ?? "";'),
    undefined,
  );
});

test("parseManifest rejects paths outside the folder and malformed hashes", () => {
  const ref = { hash: "a".repeat(64), size: 3, type: "text/markdown" };
  const manifest = {
    title: "T",
    pages: { "README.md": ref },
    media: {},
  };
  assert.ok(parseManifest(manifest));
  assert.equal(
    parseManifest({ ...manifest, media: { "../secret.png": ref } }),
    undefined,
  );
  assert.equal(
    parseManifest({
      ...manifest,
      pages: { "README.md": { ...ref, hash: "nope" } },
    }),
    undefined,
  );
  assert.equal(parseManifest({ ...manifest, pages: {} }), undefined);
});

/** The parts of productdoc.dev's API that `share` calls, keeping everything in memory. */
async function fakeProductdoc() {
  const blobs = new Map<string, Buffer>();
  const manifests = new Map<string, Manifest>();
  const stopped = new Set<string>();
  const requests: string[] = [];
  let next = 0;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const url = req.url ?? "";
      requests.push(`${req.method ?? ""} ${url}`);
      const send = (status: number, value: unknown) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(value));
      };
      if (req.headers.authorization !== "Bearer test-token")
        return send(401, { error: "Sign in first" });
      const parts = url.split("/").filter(Boolean);
      const id = parts[2];
      if (req.method === "POST" && url === "/api/documents") {
        next += 1;
        return send(201, { id: `doc${String(next).padStart(7, "0")}` });
      }
      if (req.method === "POST" && parts[3] === "missing") {
        const { hashes } = JSON.parse(body.toString()) as { hashes: string[] };
        return send(200, {
          missing: hashes.filter((hash) => !blobs.has(hash)),
        });
      }
      if (req.method === "PUT" && parts[3] === "blobs" && parts[4]) {
        const hash = createHash("sha256").update(body).digest("hex");
        if (hash !== parts[4]) return send(400, { error: "bad hash" });
        blobs.set(hash, body);
        return send(201, { hash });
      }
      if (req.method === "POST" && parts[3] === "versions" && id) {
        const { manifest } = JSON.parse(body.toString()) as {
          manifest: Manifest;
        };
        manifests.set(id, manifest);
        return send(201, { n: 1, link: `http://pd.test/d/${id}` });
      }
      if (req.method === "DELETE" && id) {
        stopped.add(id);
        return send(200, { stopped: true });
      }
      return send(404, { error: "Not found" });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("no port");
  return {
    origin: `http://127.0.0.1:${String(address.port)}`,
    blobs,
    manifests,
    stopped,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function specRepo() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "productdoc-share-"));
  const spec = path.join(root, "docs", "demo");
  await fs.mkdir(spec, { recursive: true });
  await fs.mkdir(path.join(root, "src"));
  await fs.writeFile(
    path.join(spec, "README.md"),
    "# Demo\n\n![Shot](shot.png)\n\nSee [[src/config.ts]].\n",
  );
  await fs.writeFile(
    path.join(spec, "shot.png"),
    Buffer.from([137, 80, 78, 71]),
  );
  await fs.writeFile(
    path.join(root, "src", "config.ts"),
    "export const port = 3000;\n",
  );
  const git = (...args: string[]) => execFileAsync("git", args, { cwd: root });
  await git("init", "-q");
  await git("add", "-A");
  await git(
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-q",
    "-m",
    "init",
  );
  return { root, spec };
}

test("share uploads pages, media, and source files, then --stop deletes the link", async (t) => {
  const api = await fakeProductdoc();
  const { root, spec } = await specRepo();
  process.env.PRODUCTDOC_TOKEN = "test-token";
  t.after(async () => {
    delete process.env.PRODUCTDOC_TOKEN;
    await api.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const lines: string[] = [];
  const shared = await shareDocument({
    dir: spec,
    workspaceRoot: root,
    origin: api.origin,
    allow: [],
    log: (line) => lines.push(line),
  });
  assert.ok(!(shared instanceof Error), String(shared));
  assert.equal(shared.link, "http://pd.test/d/doc0000001");
  assert.deepEqual(shared.publicSourceFiles, ["src/config.ts"]);
  assert.ok(lines.includes("Now public: src/config.ts"));
  const manifest = api.manifests.get(shared.id);
  assert.deepEqual(Object.keys(manifest?.pages ?? {}), ["README.md"]);
  assert.deepEqual(Object.keys(manifest?.media ?? {}), ["shot.png"]);
  assert.ok(manifest?.files);
  const files = JSON.parse(
    api.blobs.get(manifest.files.hash)?.toString() ?? "{}",
  ) as Record<string, string>;
  assert.equal(files["src/config.ts"], "export const port = 3000;\n");
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(spec, ".productdoc.json"), "utf8")),
    { id: shared.id, link: shared.link },
  );

  // Sharing again uploads nothing that's already there.
  const uploads = api.requests.filter((r) => r.startsWith("PUT")).length;
  const again = await shareDocument({
    dir: spec,
    workspaceRoot: root,
    origin: api.origin,
    allow: [],
    log: () => {},
  });
  assert.ok(!(again instanceof Error));
  assert.equal(api.requests.filter((r) => r.startsWith("PUT")).length, uploads);

  const stopped = await stopSharing({
    dir: spec,
    origin: api.origin,
    log: () => {},
  });
  assert.ok(!(stopped instanceof Error));
  assert.ok(api.stopped.has(again.id));
  await assert.rejects(fs.stat(path.join(spec, ".productdoc.json")));
});

test("share stops before uploading a key or a gitignored file, unless allowed", async (t) => {
  const api = await fakeProductdoc();
  const { root, spec } = await specRepo();
  process.env.PRODUCTDOC_TOKEN = "test-token";
  t.after(async () => {
    delete process.env.PRODUCTDOC_TOKEN;
    await api.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const share = (allow: string[]) =>
    shareDocument({
      dir: spec,
      workspaceRoot: root,
      origin: api.origin,
      allow,
      log: () => {},
    });

  await fs.writeFile(
    path.join(root, "src", "config.ts"),
    'export const token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";\n',
  );
  const keyed = await share([]);
  assert.ok(keyed instanceof Error);
  assert.match(
    keyed.message,
    /src\/config\.ts .*GitHub token.*--allow src\/config\.ts/,
  );
  assert.deepEqual(api.requests, []);
  assert.ok(
    !((await share([path.join(root, "src", "config.ts")])) instanceof Error),
  );

  await fs.writeFile(
    path.join(root, "src", "config.ts"),
    "export const port = 3000;\n",
  );
  await fs.writeFile(path.join(root, ".gitignore"), "shot.png\n");
  const ignored = await share([]);
  assert.ok(ignored instanceof Error);
  assert.match(ignored.message, /docs\/demo\/shot\.png .*gitignored/);
});
