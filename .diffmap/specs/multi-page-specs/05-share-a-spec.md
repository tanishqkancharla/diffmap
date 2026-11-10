# ✅ Phase 5: Share a spec as a gist

[Phase 3](03-move-between-pages.md) added `BookNav`, which any viewer passes to show a spec's page list and links. This phase uses it on diffmap.dev for specs shared as gists.

**Today**

`share` takes one file. The gist viewer already handles gists with several Markdown files: it lists them by name, alphabetically, as buttons in its header, opens `README.md` first, and fetches the whole gist from the GitHub API again every time the reader picks another file.

**Proposed**

`share .diffmap/specs/session-store/` uploads every page to one gist, with one snapshot of the commits and files that all its pages reference. A gist is flat, as a spec directory is.

```callstack [share a spec]
 result = shareMarkdownFile(path) [[1b9e6eb:src/share.ts#L32-L78]]
+├── read = readBook(path) [[adb2cb4:src/readBook.ts#L8-L44]]
+├── pages = parseBook(read) [[adb2cb4:src/readBook.ts#L49-L61]]
+├── for each page:
 │   ├── refuse local media # names the page
 │   ├── changes += readDocumentChanges(root, page.document) [[src/git.ts#readDocumentChanges]]
 │   └── files += readDocumentFiles(root, page.document)
-└── gh gist create --desc <title> spec.md diffmap-changes.json diffmap-files.json
+└── gh gist create --desc <spec title> README.md 01-….md … diffmap-changes.json diffmap-files.json
```

On diffmap.dev, a gist whose Markdown files form a spec (a README and numbered pages) gets the page list and links from [Phase 3](03-move-between-pages.md) instead of the file buttons, ordered by `makeBook` ([[1b9e6eb:src/gist/fetchGist.ts#L169-L194]]). Its pages are at `/g/<id>/<slug>`; `/g/<id>/02-write-through.md` opens the same page and settles on the slug. A gist that is not a multi-page spec keeps its file buttons.

The viewer now loads a gist once and picks the file or page from the URL as it renders ([[1b9e6eb:src/gist/GistApp.tsx#L143-L235]]), so moving between pages makes no GitHub API call. Unauthenticated calls are limited to 60 an hour, and the old viewer spent one on every file switch.

`ViewerApp` now keys a spec page's comments by the page's `href` rather than the address bar, so a page opened by its file name keeps the comments saved under its slug.

I checked `share` with a stub `gh` on `PATH`: it passed the spec's title and its three pages in order, and printed the viewer URL. I checked the gist viewer in a browser with the GitHub API stubbed: a multi-page gist opened by file name settled on the slug, the text link, pager, and Back moved between pages with one API call in total, and a gist with `README.md` and `notes.md` kept its file buttons.

```changes
1b9e6eb
src/share.ts
src/gist/fetchGist.ts
src/gist/GistApp.tsx
src/viewer/ViewerApp.tsx
src/cli.ts
README.md
```
