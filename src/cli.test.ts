import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const srcDir = fileURLToPath(new URL(".", import.meta.url));
const packageRoot = path.resolve(srcDir, "..");
const cliPath = path.join(srcDir, "cli.ts");
// The published entry point: compiled JavaScript run by plain Node, with no TypeScript loader.
const binPath = path.join(packageRoot, "bin.js");

async function runCli(args: string[]) {
  try {
    const result = await execFileAsync(process.execPath, [binPath, ...args], {
      cwd: packageRoot,
      timeout: 20_000,
      maxBuffer: 1_000_000,
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (cause) {
    if (typeof cause !== "object" || !cause) throw cause;
    const exitCode =
      "code" in cause && typeof cause.code === "number"
        ? cause.code
        : undefined;
    const stdout =
      "stdout" in cause && typeof cause.stdout === "string" ? cause.stdout : "";
    const stderr =
      "stderr" in cause && typeof cause.stderr === "string" ? cause.stderr : "";
    return { exitCode, stdout, stderr };
  }
}

test(
  "CLI telemetry attributes products and viewer actions without repository data",
  { timeout: 60_000 },
  async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-telemetry-"));
    const env: NodeJS.ProcessEnv = { ...process.env, XDG_CONFIG_HOME: dir };
    for (const key of [
      "DO_NOT_TRACK",
      "DIFFMAP_TELEMETRY",
      "DIFFMAP_DEV",
      "CI",
      "DIFFMAP_PRODUCT",
    ])
      delete env[key];
    // Intercept every HTTPS request before loading the real CLI: no event can reach PostHog.
    const preload = `data:text/javascript,${encodeURIComponent(`
    import https from "node:https";
    import { EventEmitter } from "node:events";
    https.request = () => {
      const request = new EventEmitter();
      request.end = body => {
        process.stderr.write("TELEMETRY:" + body + "\\n");
        queueMicrotask(() => request.emit("close"));
      };
      return request;
    };
  `)}`;
    type Event = {
      event: string;
      distinct_id: string;
      properties: Record<string, unknown>;
    };
    const eventsFrom = (stderr: string): Event[] =>
      stderr
        .split("\n")
        .filter((line) => line.startsWith("TELEMETRY:"))
        .map((line) => JSON.parse(line.slice("TELEMETRY:".length)) as Event);
    const command = async (extra: NodeJS.ProcessEnv = {}) => {
      const result = await execFileAsync(
        process.execPath,
        ["--import", preload, binPath, "guide"],
        {
          env: { ...env, ...extra },
          timeout: 10_000,
        },
      );
      return eventsFrom(result.stderr);
    };
    try {
      const [ordinary] = await command();
      assert.ok(ordinary);
      assert.equal(ordinary.event, "command_run");
      assert.equal(ordinary.properties.command, "guide");
      assert.equal(ordinary.properties.product, "product-docs");
      assert.equal(ordinary.properties.surface, "cli");
      const [product] = await command({ DIFFMAP_PRODUCT: "diffmap" });
      assert.ok(product);
      assert.equal(product.properties.product, "product-docs");
      assert.equal(product.properties.surface, "cli");
      assert.equal(product.distinct_id, ordinary.distinct_id);
      const [invalid] = await command({
        DIFFMAP_PRODUCT: "/private/repository-secret",
      });
      assert.equal(invalid?.properties.product, "product-docs");
      assert.ok(!JSON.stringify(invalid).includes("repository-secret"));
      for (const optOut of [
        { DO_NOT_TRACK: "1" },
        { DIFFMAP_TELEMETRY: "0" },
        { DIFFMAP_TELEMETRY: "false" },
        { DIFFMAP_DEV: "1" },
        { CI: "true" },
      ])
        assert.deepEqual(
          await command({ ...optOut, DIFFMAP_PRODUCT: "product-docs" }),
          [],
        );

      await fs.writeFile(
        path.join(dir, "README.md"),
        "# Private document title\n",
      );
      const server = spawn(
        process.execPath,
        ["--import", preload, binPath, "serve", dir, "--format", "jsonl"],
        {
          timeout: 20_000,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const exited = once(server, "exit");
      let stderr = "";
      server.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      try {
        const url = await new Promise<string>((resolve, reject) => {
          let stdout = "";
          server.stdout.on("data", (chunk) => {
            stdout += String(chunk);
            const match = /"url"\s*:\s*"([^"]+)"/.exec(stdout);
            if (match?.[1]) resolve(match[1]);
          });
          server.once("error", reject);
          server.once("exit", () => reject(new Error(stderr)));
        });
        for (const event of [
          { event: "viewer_opened" },
          { event: "viewer_opened" },
          {
            event: "comment_added",
            target: "lines",
            product: "diffmap",
            surface: "cli",
            text: "private-comment",
          },
          { event: "viewer_engaged", trigger: "scroll" },
        ]) {
          const response = await fetch(`${url}/__diffmap/telemetry`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(event),
          });
          assert.equal(response.status, 204);
        }
        await fetch(`${url}/__diffmap/shutdown`, { method: "POST" });
        const [code] = await exited;
        assert.equal(code, 0, stderr);
        const events = eventsFrom(stderr);
        assert.deepEqual(
          events.map((event) => [event.event, event.properties.surface]),
          [
            ["command_run", "cli"],
            ["serve_result", "cli"],
            ["viewer_opened", "viewer"],
            ["comment_added", "viewer"],
            ["viewer_engaged", "viewer"],
          ],
        );
        for (const event of events) {
          assert.equal(event.properties.product, "product-docs");
          assert.equal(event.distinct_id, ordinary.distinct_id);
        }
        assert.equal(
          events.find((event) => event.event === "comment_added")?.properties
            .target,
          "lines",
        );
        assert.equal(
          events.find((event) => event.event === "viewer_engaged")?.properties
            .trigger,
          "scroll",
        );
        const serialized = JSON.stringify(events);
        for (const secret of [
          dir,
          "Private document title",
          "private-comment",
          "repository-secret",
        ])
          assert.ok(!serialized.includes(secret), serialized);
      } finally {
        if (server.exitCode === null && server.signalCode === null)
          server.kill("SIGTERM");
        await exited;
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  },
);

test("product-doc --version matches package.json", async () => {
  const pkg = JSON.parse(
    await fs.readFile(path.join(packageRoot, "package.json"), "utf8"),
  ) as { version: string };
  const source = await fs.readFile(cliPath, "utf8");
  assert.doesNotMatch(source, /version:\s*["'`]\d+\.\d+\.\d+/);
  const result = await runCli(["--version"]);
  assert.equal(result.exitCode, 0, result.stderr);
  const printed = `${result.stdout}${result.stderr}`.trim();
  assert.equal(printed, pkg.version);
});

test("product-doc help exposes the successor identity", async () => {
  const result = await runCli(["--help"]);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /product-doc/);
  assert.match(result.stdout, /Explain systems, plan work, and review changes/);
  const update = await runCli(["update", "--help"]);
  assert.equal(update.exitCode, 0, update.stderr);
  assert.match(update.stdout, /latest product-doc on npm/);
  assert.doesNotMatch(update.stdout, /@tanishqkancharla\/diffmap/);
});

test("product-doc excludes generated skills and MCP but keeps completions", async () => {
  const help = await runCli(["--help"]);
  assert.equal(help.exitCode, 0, help.stderr);
  assert.doesNotMatch(help.stdout, /\bskills?\b|\bmcp\b/);
  for (const command of [
    "guide",
    "list",
    "serve",
    "share",
    "update",
    "validate",
    "completions",
  ]) {
    assert.match(help.stdout, new RegExp(`^  ${command}\\s`, "m"));
    const result = await runCli([command, "--help"]);
    assert.equal(result.exitCode, 0, result.stderr);
  }
  for (const command of ["skills", "skill"]) {
    for (const args of [[], ["--help"], ["add"], ["list"], ["ls"]]) {
      const result = await runCli([command, ...args]);
      // Unknown names remain eligible for the root's <file> shorthand.
      assert.equal(
        result.exitCode,
        args.includes("--help") ? 0 : 1,
        result.stdout + result.stderr,
      );
      assert.doesNotMatch(
        result.stdout + result.stderr,
        /Syncing|skills synced|Sync skill files|List skills/,
      );
    }
  }
  for (const shell of ["bash", "fish", "zsh", "nushell"]) {
    const completions = await execFileAsync(
      process.execPath,
      [binPath, "product-doc", ""],
      {
        cwd: packageRoot,
        env: { ...process.env, COMPLETE: shell, _COMPLETE_INDEX: "1" },
        timeout: 20_000,
      },
    );
    assert.doesNotMatch(completions.stdout, /\bskills?\b|\bmcp\b/);
    assert.match(completions.stdout, /validate/);
    assert.match(completions.stdout, /completions/);
  }
  for (const args of [
    ["mcp"],
    ["mcp", "--help"],
    ["mcp", "add"],
    ["--json", "mcp", "add"],
    ["mcp", "doctor"],
    ["--mcp"],
    ["guide", "--mcp"],
    ["--mcp", "--help"],
  ]) {
    const result = await runCli(args);
    assert.equal(result.exitCode, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /MCP is not supported/);
  }
  const typo = await runCli(["mc"]);
  assert.equal(typo.exitCode, 1);
  assert.doesNotMatch(typo.stdout + typo.stderr, /\bmcp\b/);
  for (const flag of ["--llms", "--llms-full"]) {
    const manifest = await runCli([flag, "--json"]);
    assert.equal(manifest.exitCode, 0, manifest.stderr);
    assert.deepEqual(
      JSON.parse(manifest.stdout).commands.map(
        (entry: { name: string }) => entry.name,
      ),
      ["guide", "list", "serve", "share", "update", "validate"],
    );
  }
  const schema = await runCli(["validate", "--schema", "--json"]);
  assert.equal(schema.exitCode, 0, schema.stderr);
  assert.deepEqual(JSON.parse(schema.stdout).args.required, ["file"]);
  const count = await runCli(["guide", "--token-count"]);
  assert.equal(count.exitCode, 0, count.stderr);
  assert.ok(Number(count.stdout) > 0);
});

test("product-doc guide prints guide.md, and each topic it names", async () => {
  const guide = await fs.readFile(path.join(packageRoot, "guide.md"), "utf8");
  const result = await runCli(["guide"]);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stdout.trim(), guide.trim());
  for (const topic of [
    "services",
    "callstack",
    "mermaid",
    "code",
    "previews",
    "ui",
  ]) {
    const part = await fs.readFile(
      path.join(packageRoot, "guide", `${topic}.md`),
      "utf8",
    );
    assert.match(guide, new RegExp(`product-doc guide ${topic}\\b`));
    const printed = await runCli(["guide", topic]);
    assert.equal(printed.exitCode, 0, printed.stderr);
    assert.equal(printed.stdout.trim(), part.trim());
  }
});

test("product-doc validate checks specs without starting a server", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-validate-"));
  const cover = path.join(dir, "README.md");
  try {
    await fs.writeFile(
      cover,
      "```ts\nsave(record);\nsave(record);\n// [!note L2 save] Second line.\n```\n",
    );
    const valid = await runCli(["validate", dir, "--json"]);
    assert.equal(valid.exitCode, 0, valid.stderr);
    assert.deepEqual(JSON.parse(valid.stdout), {
      file: dir,
      valid: true,
      pages: ["README.md"],
    });
    const filtered = await runCli([
      "validate",
      dir,
      "--json",
      "--filter-output",
      "pages",
    ]);
    assert.equal(filtered.exitCode, 0, filtered.stderr);
    assert.deepEqual(JSON.parse(filtered.stdout), { pages: ["README.md"] });
    for (const [source, message] of [
      [
        "```ts\nsave(record);\n// [!note L2 save] Out of range.\n```\n",
        /outside the 1-line code fence/,
      ],
      ["```mermaid\nflwochart TD\n A --> B\n```\n", /Invalid mermaid header/],
      [
        '```services\nservice API\nstep "Send"\n  API -> Auth: hi\n```\n',
        /Unknown service Auth/,
      ],
    ] as const) {
      await fs.writeFile(cover, source);
      const invalid = await runCli(["validate", dir]);
      assert.equal(invalid.exitCode, 1, invalid.stdout + invalid.stderr);
      assert.match(invalid.stdout + invalid.stderr, message);
      // Every error names the page it came from.
      assert.match(invalid.stdout + invalid.stderr, /README\.md/);
    }

    // A spec is a directory; a Markdown file alone is not one.
    const file = await runCli(["validate", cover]);
    assert.equal(file.exitCode, 1);
    assert.match(file.stdout + file.stderr, /a spec is a directory/);
    await fs.unlink(cover);
    const noCover = await runCli(["validate", dir]);
    assert.equal(noCover.exitCode, 1);
    assert.match(noCover.stdout + noCover.stderr, /no README\.md/);

    // Every page parses, and a failure names its page.
    await fs.writeFile(cover, "# Spec\n");
    await fs.writeFile(path.join(dir, "10-last.md"), "# Last\n");
    await fs.writeFile(
      path.join(dir, "2-broken.md"),
      "```mermaid\nflwochart TD\n A --> B\n```\n",
    );
    const broken = await runCli(["validate", dir]);
    assert.equal(broken.exitCode, 1);
    assert.match(broken.stdout + broken.stderr, /2-broken\.md/);
    await fs.writeFile(path.join(dir, "2-broken.md"), "# Fixed\n");
    const pages = await runCli(["validate", dir, "--json"]);
    assert.equal(pages.exitCode, 0, pages.stderr);
    assert.deepEqual(JSON.parse(pages.stdout).pages, [
      "README.md",
      "2-broken.md",
      "10-last.md",
    ]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
