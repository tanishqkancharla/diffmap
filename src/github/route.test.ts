import assert from "node:assert/strict";
import test from "node:test";
import {
  githubCommitPath,
  githubPullPath,
  githubViewerUrl,
  parseGitHubPath,
} from "./route.ts";

test("parseGitHubPath reads pull and commit spec URLs", () => {
  assert.deepEqual(
    parseGitHubPath(
      "/tanishqkancharla/diffmap/pull/5/specs/merge-generate-spec-walkthrough.md",
    ),
    {
      kind: "github-pull",
      owner: "tanishqkancharla",
      repo: "diffmap",
      pull: 5,
      path: "specs/merge-generate-spec-walkthrough.md",
    },
  );
  assert.deepEqual(
    parseGitHubPath(
      "/tanishqkancharla/diffmap/commit/0123456789abcdef0123456789abcdef01234567/specs/a.md",
    ),
    {
      kind: "github-commit",
      owner: "tanishqkancharla",
      repo: "diffmap",
      sha: "0123456789abcdef0123456789abcdef01234567",
      path: "specs/a.md",
    },
  );
  assert.equal(parseGitHubPath("/").kind, "home");
  assert.equal(
    parseGitHubPath("/g/0123456789abcdef0123456789abcdef").kind,
    "home",
  );
  assert.equal(
    parseGitHubPath("/tanishqkancharla/diffmap/pull/5").kind,
    "github-invalid",
  );
  assert.equal(
    parseGitHubPath("/tanishqkancharla/diffmap/pull/5/src/cli.ts").kind,
    "github-invalid",
  );
});

test("printed GitHub viewer URLs pin pull or commit", () => {
  assert.equal(
    githubPullPath(
      "tanishqkancharla",
      "diffmap",
      5,
      "specs/merge-generate-spec-walkthrough.md",
    ),
    "/tanishqkancharla/diffmap/pull/5/specs/merge-generate-spec-walkthrough.md",
  );
  assert.equal(
    githubCommitPath("o", "r", "deadbeef", "docs/a b.md"),
    "/o/r/commit/deadbeef/docs/a%20b.md",
  );
  assert.equal(
    githubViewerUrl("tanishqkancharla", "diffmap", { pull: 5 }, "specs/x.md"),
    "https://diffmap.dev/tanishqkancharla/diffmap/pull/5/specs/x.md",
  );
});
