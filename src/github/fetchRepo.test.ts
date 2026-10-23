import assert from "node:assert/strict";
import test from "node:test";
import { fetchGitHubChanges, findSymbolLineRange } from "./fetchRepo.ts";

test("findSymbolLineRange highlights a function declaration", () => {
  const source = ["const x = 1;", "export function startServer() {", "}"].join(
    "\n",
  );
  assert.deepEqual(findSymbolLineRange(source, "startServer"), {
    start: 2,
    end: 2,
  });
  assert.deepEqual(findSymbolLineRange(source, "Serve.startServer"), {
    start: 2,
    end: 2,
  });
});

/** `count` modified files, as the GitHub API lists them. */
function files(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    filename: `${prefix}${String(index)}.ts`,
    status: "modified",
    additions: 1,
  }));
}

test("fetchGitHubChanges follows a commit's file pages and marks a capped compare", async (t) => {
  const requested: string[] = [];
  t.mock.method(globalThis, "fetch", (url: string) => {
    const { pathname, search } = new URL(url);
    requested.push(`${pathname}${search}`);
    if (pathname.endsWith("/commits/aaaaaaa")) {
      const next = search === "";
      return Promise.resolve(
        Response.json(
          {
            commit: { message: "Big change\n\nBody" },
            files: next ? files("first", 300) : files("second", 2),
          },
          next
            ? {
                headers: {
                  link: '<https://api.github.com/repositories/1/commits/aaaaaaa?page=2>; rel="next"',
                },
              }
            : {},
        ),
      );
    }
    return Promise.resolve(
      Response.json({ total_commits: 4, files: files("compare", 300) }),
    );
  });

  const commit = await fetchGitHubChanges({ owner: "o", repo: "r" }, "aaaaaaa");
  assert.equal(commit instanceof Error, false);
  if (commit instanceof Error) return;
  assert.equal(commit.title, "Big change");
  assert.equal(commit.files.length, 302);
  assert.equal(commit.truncated, undefined);
  assert.deepEqual(requested, [
    "/repos/o/r/commits/aaaaaaa",
    "/repositories/1/commits/aaaaaaa?page=2",
  ]);

  const compare = await fetchGitHubChanges(
    { owner: "o", repo: "r" },
    "bbbbbbb..ccccccc",
  );
  assert.equal(compare instanceof Error, false);
  if (compare instanceof Error) return;
  assert.equal(compare.files.length, 300);
  assert.equal(compare.truncated, true);
});
