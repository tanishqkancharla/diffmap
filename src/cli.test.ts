import assert from "node:assert/strict";
import { execFile } from "node:child_process";
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

test("diffmap --version matches package.json", async () => {
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

test("diffmap guide prints guide.md", async () => {
  const guide = await fs.readFile(path.join(packageRoot, "guide.md"), "utf8");
  const result = await runCli(["guide"]);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stdout.trim(), guide.trim());
});

test("diffmap validate checks specs without starting a server", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-validate-"));
  const file = path.join(dir, "spec.md");
  try {
    await fs.writeFile(
      file,
      "```ts\nsave(record);\nsave(record);\n// [!note L2 save] Second line.\n```\n",
    );
    const valid = await runCli(["validate", file, "--json"]);
    assert.equal(valid.exitCode, 0, valid.stderr);
    assert.deepEqual(JSON.parse(valid.stdout), { file, valid: true });
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
      await fs.writeFile(file, source);
      const invalid = await runCli(["validate", file]);
      assert.equal(invalid.exitCode, 1, invalid.stdout + invalid.stderr);
      assert.match(invalid.stdout + invalid.stderr, message);
    }
    await fs.unlink(file);
    const missing = await runCli(["validate", file]);
    assert.equal(missing.exitCode, 1);
    assert.match(missing.stdout + missing.stderr, /could not read/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
