import assert from "node:assert/strict";
import test from "node:test";
import { compareVersions, resolveUpdateArgv } from "./update.js";

test("compareVersions orders versions by semver precedence", () => {
  assert.equal(compareVersions("0.1.4", "0.1.4"), 0);
  assert.equal(compareVersions("0.1.4", "0.1.5"), -1);
  assert.equal(compareVersions("0.1.10", "0.1.9"), 1);
  assert.equal(compareVersions("1.0.0-rc.1", "1.0.0"), -1);
});

test("update and --update run the same command", () => {
  assert.deepEqual(resolveUpdateArgv(["update"]), ["update"]);
  assert.deepEqual(resolveUpdateArgv(["--update"]), ["update"]);
  assert.deepEqual(resolveUpdateArgv(["serve", "spec.md"]), [
    "serve",
    "spec.md",
  ]);
});
