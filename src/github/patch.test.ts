import assert from "node:assert/strict";
import test from "node:test";
import { parsePatchFiles } from "@pierre/diffs";
import { pullFilesToSourceDiffs, wrapGitHubPullPatch } from "./patch.ts";

test("wrapGitHubPullPatch builds a unified diff Pierre can parse", () => {
  const wrapped = wrapGitHubPullPatch({
    filename: "src/cli.ts",
    status: "modified",
    patch: ["@@ -1,3 +1,4 @@", " line", "+added", " line", " line"].join("\n"),
  });
  assert.equal(typeof wrapped, "string");
  const patches = parsePatchFiles(wrapped!, undefined, true);
  assert.equal(patches[0]?.files[0]?.name, "src/cli.ts");
  assert.ok((patches[0]?.files[0]?.hunks.length ?? 0) > 0);
});

test("pullFilesToSourceDiffs skips files without a patch", () => {
  const diffs = pullFilesToSourceDiffs([
    { filename: "icon.png", status: "added" },
    {
      filename: "src/cli.ts",
      status: "modified",
      patch: ["@@ -1,2 +1,3 @@", " a", "+b", " c"].join("\n"),
    },
  ]);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0]?.id, "pr:src/cli.ts");
  assert.equal(diffs[0]?.fileDiff.name, "src/cli.ts");
});
