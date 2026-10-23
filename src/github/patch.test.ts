import assert from "node:assert/strict";
import test from "node:test";
import { parsePatchFiles } from "@pierre/diffs";
import { changedFileItem } from "../changes.ts";
import { githubChangedFiles, wrapGitHubPatch } from "./patch.ts";

test("wrapGitHubPatch builds a unified diff Pierre can parse", () => {
  const wrapped = wrapGitHubPatch({
    filename: "src/cli.ts",
    status: "modified",
    patch: ["@@ -1,3 +1,4 @@", " line", "+added", " line", " line"].join("\n"),
  });
  assert.equal(typeof wrapped, "string");
  const patches = parsePatchFiles(wrapped!, undefined, true);
  assert.equal(patches[0]?.files[0]?.name, "src/cli.ts");
  assert.ok((patches[0]?.files[0]?.hunks.length ?? 0) > 0);
});

test("githubChangedFiles keeps files without a patch as binary, with no diff item", () => {
  const files = githubChangedFiles([
    { filename: "icon.png", status: "added", additions: 0, deletions: 0 },
    {
      filename: "src/cli.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      patch: ["@@ -1,2 +1,3 @@", " a", "+b", " c"].join("\n"),
    },
  ]);
  assert.deepEqual(
    files.map((file) => [file.path, file.binary, file.additions]),
    [
      ["icon.png", true, 0],
      ["src/cli.ts", false, 1],
    ],
  );
  assert.equal(changedFileItem(files[0]!), undefined);
  assert.equal(changedFileItem(files[1]!)?.fileDiff.name, "src/cli.ts");
});
