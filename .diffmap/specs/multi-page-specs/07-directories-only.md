# ✅ Phase 7: Only directories

Phases [1](01-read-a-directory.md) through [6](06-open-on-a-pull-request.md) added multi-page specs alongside single-file ones, which diffmap read as a spec with only a cover. This phase removes single-file specs, so every spec has the same shape.

**Today**

`serve`, `validate`, and `share` take a directory or one Markdown file. The guide only describes directories, but an agent that passes a file still gets a page, and the code keeps a second path for it.

**Proposed**

A spec is always a directory. Passing a file fails, and the error says what to pass instead:

```sh
$ diffmap serve .diffmap/specs/sessions.md
Error (DIFFMAP): diffmap spec .diffmap/specs/sessions.md: a spec is a directory, not a file. Move this file to .diffmap/specs/sessions/README.md and give each phase its own numbered page

$ diffmap serve .diffmap/specs/sessions/02-write-through.md
Error (DIFFMAP): diffmap spec .diffmap/specs/sessions/02-write-through.md: a spec is a directory, not a file. Pass this page's spec, .diffmap/specs/sessions
```

The only reader of files from disk, [[20dcf5f:src/readBook.ts#L15-L28]], returns that error, so `serve`, `validate`, and `share` all reject files. The code that handled a single file is gone: `singlePageBook`, and the branches in `serve`'s watcher and `share`'s media error that asked whether the spec was a directory.

```callstack [readBook]
 read = readBook(path) [[20dcf5f:src/readBook.ts#L8-L45]]
-├── if path is a file: return a spec with only a cover
+├── if path is a file: return an error naming the directory to use
 ├── files = every .md in the directory
 └── return makeBook(dir, files)
```

Now that every error comes from a page of a spec, [[20dcf5f:src/readBook.ts#L50-L63]] names the page on errors that don't already. A Mermaid error already names its file, so it stays as it is, without the path twice.

The word "book" is gone from what people read: the guide, the README, the CLI's help, and its errors say "spec". The code still calls a spec a `Book` and its files `BookPage`s.

Every fixture is now a directory with a `README.md`, so the README's `npx @tanishqkancharla/diffmap fixtures/annotations` commands work. `fixtures/book` is now `fixtures/sessions-in-postgres`, and this repository's earlier spec is now `.diffmap/specs/merge-generate-spec-walkthrough/`.

diffmap.dev keeps opening single files, so gists and pull request links from before this phase keep working. A gist that is not a multi-page spec shows its file buttons, and a pull request URL to a `.md` file that is not a page opens alone.

The CLI test now validates a directory, then checks that a file is rejected, that a missing `README.md` is named, and that an error without a path names its page. The parser and server tests serve and share temporary spec directories instead of files.

```changes
20dcf5f
src/readBook.ts
src/serve.ts
src/share.ts
src/book.ts
src/cli.ts
src/errors.ts
src/github/route.ts
guide.md
README.md
src/cli.test.ts
src/serve.test.ts
src/parseViewer.test.ts

ignore:
.diffmap/specs/merge-generate-spec-walkthrough/README.md
fixtures/annotations/README.md
fixtures/code-notes/README.md
fixtures/diagram-diffs/README.md
fixtures/media/README.md
fixtures/references/README.md
fixtures/sample-mdx/README.mdx
fixtures/sample-spec/README.md
fixtures/services/README.md
fixtures/sessions-in-postgres/README.md
fixtures/sessions-in-postgres/01-sessions-table.md
fixtures/sessions-in-postgres/02-write-through.md
fixtures/spec-then-implement/README.md
```
