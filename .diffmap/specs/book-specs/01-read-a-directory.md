# ✅ Phase 1: Read a directory as a book

The [cover](README.md) says what a book is: a `README.md` cover and numbered pages. This phase teaches diffmap to read one from disk and to check it, before anything serves it.

**Today**

`validate` reads one file and parses it. Pass it a directory and it fails with a read error.

**Proposed**

`validate .diffmap/specs/session-store/` checks every page and prints the book's order, so an agent can check a book before it serves it. An error names the page it came from:

```sh
$ diffmap validate .diffmap/specs/session-store/
file: /repo/.diffmap/specs/session-store
valid: true
pages[3]: README.md,01-sessions-table.md,02-write-through.md

$ diffmap validate .diffmap/specs/session-store/
Error: diffmap book .diffmap/specs/session-store: notes.md needs a number prefix that sets its place in the book, as in 01-notes.md
```

Two new files split the work. [[fdfc4c0:src/book.ts#L39-L82]] holds the page rule with no Node imports, so the browser viewers in [Phase 5](05-share-a-book.md) and [Phase 6](06-open-on-a-pull-request.md) order pages the same way. [[fdfc4c0:src/readBook.ts#L8-L44]] reads a directory, or wraps a single file as a book with only a cover, and `parseBook` parses every page:

```callstack [validate]
 result = validate(path) [[fdfc4c0:src/cli.ts#L95-L118]]
-├── source = readFile(path)
-└── parseViewerDocument(source, path) [[src/parseViewer.ts#parseViewerDocument]]
+├── read = readBook(path) [[fdfc4c0:src/readBook.ts#L8-L44]]
+│   ├── files = every .md in the directory, or the one file
+│   └── book = makeBook(dir, files) [[fdfc4c0:src/book.ts#L39-L82]] # README.md first, then by number
+├── pages = parseBook(read) [[fdfc4c0:src/readBook.ts#L49-L61]] # a failure names its page
+└── return { file, valid: true, pages: [README.md, 01-…, …] }
```

`validate` on a single file now also prints `pages: [spec.md]`; nothing else about it changed.

The tests in [[fdfc4c0:src/book.test.ts]] pick inputs where a plausible wrong rule fails: `10-` after `2-` and `9-` (string order would put it first), a `# comment` in a shell fence above the real title, a missing README, a page without a number, and two slugs that differ only in case. The CLI test validates a three-page directory and a broken page.

```changes
fdfc4c0
src/book.ts
src/readBook.ts
src/cli.ts
src/errors.ts
src/book.test.ts
src/cli.test.ts

ignore:
package.json
```
