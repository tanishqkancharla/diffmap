import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGitHubChanges,
  findSymbolLineRange,
  loadPinnedSpec,
} from "./fetchRepo.ts";

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

test("loadPinnedSpec opens a spec's directory at its cover and a page file in its spec", async (t) => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const requested: string[] = [];
  const raw: Record<string, string> = {
    "README.md": "# Sessions\n",
    "01-table.md": "# Phase 1: Table\n",
    "02-write.md": "# Phase 2: Write\n",
  };
  t.mock.method(globalThis, "fetch", (url: string) => {
    const { host, pathname } = new URL(url);
    requested.push(`${host}${pathname}`);
    if (host === "raw.githubusercontent.com") {
      const name = pathname.split("/").at(-1) ?? "";
      return Promise.resolve(new Response(raw[name]));
    }
    if (pathname === "/repos/o/r/contents/.diffmap/specs/sessions") {
      return Promise.resolve(
        Response.json([
          ...Object.keys(raw).map((name) => ({ name, type: "file" })),
          { name: "media", type: "dir" },
        ]),
      );
    }
    if (pathname === "/repos/o/r/contents/.diffmap/specs") {
      return Promise.resolve(
        Response.json([{ name: "plain.md", type: "file" }]),
      );
    }
    if (pathname === "/repos/o/r/contents/.diffmap/specs/plain.md") {
      return Promise.resolve(
        Response.json({
          type: "file",
          encoding: "base64",
          content: btoa("# Plain\n"),
        }),
      );
    }
    return Promise.resolve(new Response("", { status: 404 }));
  });

  const cover = await loadPinnedSpec({
    owner: "o",
    repo: "r",
    sha,
    path: ".diffmap/specs/sessions",
  });
  assert.equal(cover.status, "ok");
  if (cover.status !== "ok") return;
  assert.equal(cover.spec.path, ".diffmap/specs/sessions/README.md");
  assert.equal(cover.spec.content, "# Sessions\n");
  assert.deepEqual(
    cover.spec.pages?.spec.pages.map((page) => page.slug),
    ["", "table", "write"],
  );

  // The spec is read once per commit; its pages open without another request.
  const before = requested.length;
  const page = await loadPinnedSpec({
    owner: "o",
    repo: "r",
    sha,
    path: ".diffmap/specs/sessions/02-write.md",
  });
  assert.equal(page.status, "ok");
  if (page.status !== "ok") return;
  assert.equal(page.spec.content, "# Phase 2: Write\n");
  assert.equal(page.spec.pages?.dir, ".diffmap/specs/sessions");
  assert.equal(requested.length, before);

  // A file whose name is not a page's opens alone, without listing its directory.
  const plain = await loadPinnedSpec({
    owner: "o",
    repo: "r",
    sha,
    path: ".diffmap/specs/plain.md",
  });
  assert.equal(plain.status, "ok");
  if (plain.status !== "ok") return;
  assert.equal(plain.spec.content, "# Plain\n");
  assert.equal(plain.spec.pages, undefined);
  assert.equal(
    requested.includes("api.github.com/repos/o/r/contents/.diffmap/specs"),
    false,
  );
});
