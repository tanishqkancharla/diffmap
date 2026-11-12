import assert from "node:assert/strict";
import test from "node:test";
import { findPage, linkedPage, makeSpec } from "./spec.ts";

const page = (file: string, source = `# ${file}\n`) => ({ file, source });

test("makeSpec puts the cover first and orders pages by number, not by name", () => {
  const spec = makeSpec("spec", [
    page("10-cleanup.md"),
    page("2-write.md", "```sh\n# not a title\n```\n# Phase 2: Write\n"),
    page("README.md", "# Sessions in Postgres\n"),
    page("9-read.mdx"),
    page("media.png"),
  ]);
  assert.ok(!(spec instanceof Error), String(spec));
  assert.equal(spec.title, "Sessions in Postgres");
  assert.deepEqual(
    spec.pages.map((p) => [p.file, p.slug]),
    [
      ["README.md", ""],
      ["2-write.md", "write"],
      ["9-read.mdx", "read"],
      ["10-cleanup.md", "cleanup"],
    ],
  );
});

test("makeSpec names the file that breaks the spec", () => {
  const noCover = makeSpec("spec", [page("01-a.md")]);
  assert.ok(noCover instanceof Error);
  assert.match(noCover.message, /no README\.md/);

  const unnumbered = makeSpec("spec", [page("README.md"), page("notes.md")]);
  assert.ok(unnumbered instanceof Error);
  assert.match(unnumbered.message, /notes\.md needs a number prefix/);

  const shared = makeSpec("spec", [
    page("README.md"),
    page("01-Write.md"),
    page("02-write.md"),
  ]);
  assert.ok(shared instanceof Error);
  assert.match(shared.message, /01-Write\.md and 02-write\.md/);
});

test("findPage and linkedPage find pages by slug or file name", () => {
  const spec = makeSpec("spec", [
    page("README.md"),
    page("01-sessions-table.md"),
    page("02-write-through.md"),
  ]);
  assert.ok(!(spec instanceof Error));
  assert.equal(findPage(spec, undefined)?.file, "README.md");
  assert.equal(findPage(spec, "write-through")?.file, "02-write-through.md");
  assert.equal(findPage(spec, "01-Sessions-Table.md")?.slug, "sessions-table");
  assert.equal(findPage(spec, "missing"), undefined);

  assert.deepEqual(linkedPage(spec, "./02-write-through.md#tests"), {
    page: spec.pages[2],
    hash: "#tests",
  });
  assert.equal(linkedPage(spec, "README.md")?.page.slug, "");
  for (const href of [
    "#tests",
    "../other/02-write-through.md",
    "https://example.com/02-write-through.md",
    "03-missing.md",
  ]) {
    assert.equal(linkedPage(spec, href), undefined, href);
  }
});
