import assert from "node:assert/strict";
import test from "node:test";
import {
  compareVersions,
  fetchLatestVersion,
  resolveUpdateArgv,
  runUpdate,
} from "./update.js";

test("compareVersions orders versions by semver precedence", () => {
  assert.equal(compareVersions("0.1.4", "0.1.4"), 0);
  assert.equal(compareVersions("0.1.4", "0.1.5"), -1);
  assert.equal(compareVersions("0.1.10", "0.1.9"), 1);
  assert.equal(compareVersions("1.0.0-rc.1", "1.0.0"), -1);
});

test("updates resolve and install only the productdoc package", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "https://registry.npmjs.org/product-doc/latest");
    return Response.json({ version: "0.14.0" });
  });
  assert.equal(await fetchLatestVersion(), "0.14.0");
  for (const method of ["npm", "pnpm", "bun", "npx", "unknown"] as const) {
    let installed: string | undefined;
    const result = await runUpdate({
      currentVersion: "0.13.1",
      fetchLatestVersion,
      detectInstallMethod: async () => method,
      runCommand: async ({ command, args }) => {
        installed = [command, ...args].join(" ");
      },
    });
    assert.ok(!(result instanceof Error));
    const expected =
      method === "npx"
        ? "npx product-doc@latest"
        : `${method === "unknown" ? "npm" : method} ${method === "npm" || method === "unknown" ? "install" : "add"} --global product-doc@latest`;
    assert.notEqual(result.status, "up-to-date");
    assert.ok("command" in result);
    assert.equal(result.command, expected);
    assert.equal(
      result.status,
      method === "npx" || method === "unknown" ? "manual" : "updated",
    );
    assert.equal(
      installed,
      method === "npx" || method === "unknown" ? undefined : expected,
    );
    assert.match(result.message, /product-doc/);
    assert.doesNotMatch(result.message, /diffmap/);
  }
});

test("update and --update run the same command", () => {
  assert.deepEqual(resolveUpdateArgv(["update"]), ["update"]);
  assert.deepEqual(resolveUpdateArgv(["--update"]), ["update"]);
  assert.deepEqual(resolveUpdateArgv(["serve", "spec.md"]), [
    "serve",
    "spec.md",
  ]);
});
