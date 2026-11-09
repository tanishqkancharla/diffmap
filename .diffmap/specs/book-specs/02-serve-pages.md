# ✅ Phase 2: Serve each page at its own URL

[Phase 1](01-read-a-directory.md) added `readBook`, which reads a book's pages in order. This phase serves them, one page per URL.

**Today**

`serve` reads one file, and the viewer always fetches that file's document from `/__diffmap/document`. The server watches the file's directory but reloads only on changes to that one file.

**Proposed**

`serve .diffmap/specs/session-store/` serves the cover at `/` and each page at `/<slug>`. A link to a page's file, such as `/02-write-through.md`, opens that page and settles on `/write-through`. Each page's comments, Reviewed checkboxes, and Diff button are its own: comments and Reviewed already saved under the URL's path, so per-page URLs separate them, and the Diff button opens the page's first `changes` card, which is its phase's commit.

```mermaid diff [serve reads a book]
 flowchart LR
-  File["spec.md"] --> Serve[startServer]
+  Dir[".diffmap/specs/name/"] --> Read[readBook]
+  Read --> Serve[startServer]
   Serve -->|/__diffmap/document?page=slug| Viewer[ViewerApp]
+  Serve -->|/__diffmap/book| Viewer
   %% ref node:Read [[fdfc4c0:src/readBook.ts#L8-L44]]
   %% ref node:Serve [[d8e63e3:src/serve.ts#L82-L96]]
   %% ref node:Viewer [[d8e63e3:src/viewer/main.tsx]]
```

- At startup, `startServer` parses every page and collects `changes` warnings from all of them, so a broken page still stops `serve` ([[d8e63e3:src/serve.ts#L82-L96]]).
- `/__diffmap/book` returns the title and the ordered pages (`file`, `slug`, `title`). `/__diffmap/document?page=<slug>` returns one page's document, cached per page until its source changes ([[d8e63e3:src/serve.ts#L606-L676]]).
- `Accept: text/markdown` on `/<slug>` returns that page's source, so an agent can read one page of a served book. An unknown page is a 404.
- `/__diffmap/media` resolves paths against the book's directory, where every page lives.
- `list` shows the directory and the cover's title.

Live reload changed the most. The server now watches every page, but a reader on one page should not lose their place because another page changed:

```services [Live reload in a book]
service Agent
service Server "diffmap serve" [[d8e63e3:src/serve.ts#L122-L160]]
  state outline = 3 pages
service Browser "reader on /write-through"
  state page = 02-write-through.md

start "The agent edits three times"
  > The server names the file that changed. A tab reloads only for its own page, or for `book` when the list of pages or a title changed.
step "The agent edits the cover's text"
  Agent -> Server: save README.md
  Server -> Browser: README.md
    > Not this tab's page, and the page list is the same, so the tab stays put.
step "The agent adds a page"
  Agent -> Server: save 04-cleanup.md
  Server.outline = 4 pages
  Server -> Browser: book
    > The page list changed, so the tab reloads to show the new page in it.
step "The agent edits this page"
  Agent -> Server: save 02-write-through.md
  Server -> Browser: 02-write-through.md
    > This tab's page, so it reloads.
```

Before, the reload frame always said `change`. Now [[d8e63e3:src/serve.ts#L49-L63]] writes a text frame with the changed file's name, or `book` when the outline (each page's file, slug, and title) differs from the last one sent.

`src/serve.test.ts` serves a three-page book and checks the page order, a page's document and Markdown, a 404 for an unknown page, and each of the three reload messages above.

```changes
d8e63e3
src/serve.ts
src/viewer/main.tsx
src/serve.test.ts
```
