import assert from "node:assert/strict";
import test from "node:test";
import { findPage, linkedPage, makeBook } from "./book.ts";

const page = (file: string, source = `# ${file}\n`) => ({ file, source });

test("makeBook puts the cover first and orders pages by number, not by name", () => {
  const book = makeBook("book", [
    page("10-cleanup.md"),
    page("2-write.md", "```sh\n# not a title\n```\n# Phase 2: Write\n"),
    page("README.md", "# Sessions in Postgres\n"),
    page("9-read.mdx"),
    page("media.png"),
  ]);
  assert.ok(!(book instanceof Error), String(book));
  assert.equal(book.title, "Sessions in Postgres");
  assert.deepEqual(
    book.pages.map((p) => [p.file, p.slug]),
    [
      ["README.md", ""],
      ["2-write.md", "write"],
      ["9-read.mdx", "read"],
      ["10-cleanup.md", "cleanup"],
    ],
  );
});

test("makeBook names the file that breaks the book", () => {
  const noCover = makeBook("book", [page("01-a.md")]);
  assert.ok(noCover instanceof Error);
  assert.match(noCover.message, /no README\.md/);

  const unnumbered = makeBook("book", [page("README.md"), page("notes.md")]);
  assert.ok(unnumbered instanceof Error);
  assert.match(unnumbered.message, /notes\.md needs a number prefix/);

  const shared = makeBook("book", [
    page("README.md"),
    page("01-Write.md"),
    page("02-write.md"),
  ]);
  assert.ok(shared instanceof Error);
  assert.match(shared.message, /01-Write\.md and 02-write\.md/);
});

test("findPage and linkedPage find pages by slug or file name", () => {
  const book = makeBook("book", [
    page("README.md"),
    page("01-sessions-table.md"),
    page("02-write-through.md"),
  ]);
  assert.ok(!(book instanceof Error));
  assert.equal(findPage(book, undefined)?.file, "README.md");
  assert.equal(findPage(book, "write-through")?.file, "02-write-through.md");
  assert.equal(findPage(book, "01-Sessions-Table.md")?.slug, "sessions-table");
  assert.equal(findPage(book, "missing"), undefined);

  assert.deepEqual(linkedPage(book, "./02-write-through.md#tests"), {
    page: book.pages[2],
    hash: "#tests",
  });
  assert.equal(linkedPage(book, "README.md")?.page.slug, "");
  for (const href of [
    "#tests",
    "../other/02-write-through.md",
    "https://example.com/02-write-through.md",
    "03-missing.md",
  ]) {
    assert.equal(linkedPage(book, href), undefined, href);
  }
});
