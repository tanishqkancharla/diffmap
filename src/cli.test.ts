import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const srcDir = fileURLToPath(new URL(".", import.meta.url));
const packageRoot = path.resolve(srcDir, "..");
const cliPath = path.join(srcDir, "cli.ts");

async function runCli(args: string[]) {
  try {
    const result = await execFileAsync(
      process.execPath,
      ["--import", "tsx", cliPath, ...args],
      {
        cwd: packageRoot,
        timeout: 20_000,
        maxBuffer: 1_000_000,
      },
    );
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
