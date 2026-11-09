# Specs as books

## Problem overview

A spec was one Markdown file. On a real change it grows to a dozen phases, each with diagrams, call stacks, and a `changes` card, so it is long to scroll and long to load:

- A reviewer who wants Phase 4 scrolls past Phases 1–3, and the table of contents lists every heading of every phase.
- An agent that updates one phase reads and rewrites the whole file, and an edit that goes wrong can break a phase it did not touch.
- One page holds every phase, so the Diff button opens the first `changes` card, not the phase the reader is on.

## Solution overview

A spec is now a **book**: a directory in `.diffmap/specs/`. `README.md` is the cover, with the problem, the solution, goals, and non-goals. Every other page is a file whose name starts with a number, which sets its place in the book. Usually there is one page per phase.

```text [.diffmap/specs/session-store/]
README.md                     cover: problem, solution, goals, non-goals
01-sessions-table.md          Phase 1
02-write-through.md           Phase 2
03-drop-memory-cache.md       Phase 3
media/drop-memory-cache/      captures for Phase 3
```

`diffmap serve .diffmap/specs/session-store/` shows one page at a time, at its own URL, with the book's pages in the left gutter and links to the previous and next page at the bottom. Each page reads on its own: it assumes the reader knows the cover and skimmed the pages before it, not every detail of them.

A single file still works. diffmap reads `spec.md` as a book with only a cover, so existing specs, gists, and pull request links keep working, and one code path serves both.

```tsx
// The one rule every viewer uses to turn file names into pages (src/book.ts).
type BookPage = {
  file: string; // "02-write-through.md"
  slug: string; // "write-through", or "" for the cover
  title: string; // the page's first # heading
};

function makeBook(dir: string, files: { file: string; source: string }[]) {
  // README.md is the cover and is required.
  // Every other .md needs a number prefix: "notes.md needs a number prefix ... as in 01-notes.md".
  // Pages sort by that number, so 10- comes after 9-; two pages may not share a slug.
  return { title: cover.title, pages: [cover, ...numberedPagesInOrder] };
}
```

### Why number prefixes

The order has to live somewhere the agent cannot forget to update. Three places were considered:

| Order comes from                    | For                                                                                                 | Against                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **`NN-` file name prefix (chosen)** | `ls` and GitHub's file list show the order; adding a page is one file; nothing else to keep in sync | Inserting a page in the middle renames the pages after it                                |
| A `SUMMARY.md` manifest, as mdBook  | Explicit, and can nest sections                                                                     | A second file to keep in sync; agents add a page and forget the manifest, or the reverse |
| `order:` front matter in each page  | File names stay clean                                                                               | Order is invisible in `ls`; two pages can claim the same number without anyone noticing  |

The local and gist URLs use the name without its number (`/write-through`), so renumbering pages does not break an open tab, a link, or the comments saved for that page. `README.md` as the cover means GitHub shows it when someone browses the spec's directory, and the gist viewer already preferred it.

### Decisions

- **`README.md` is required.** Without it, `/` has no clear page, and the problem and goals end up repeated on every page.
- **A Markdown file without a number prefix is an error**, with a message that names the file and suggests a number. Otherwise an appendix such as `references.md` lands in an order nobody chose.
- **Copy comments copies the whole book**, grouped by page, since a reviewer reads several pages and then pastes once.
- **Gist URLs use slugs; pull request URLs keep file names.** A gist page is `/g/<id>/write-through`, and the gist's file name still works. A pull request URL pins to one commit, where no file is ever renamed, so its pages are the files themselves, as GitHub names them.
- **`.diffmap/specs/` is the one place specs live**, committed with the code, including walkthroughs of pull requests. This repository's own specs moved there.

## Goals

- `serve`, `validate`, and `share` accept a directory, and diffmap.dev opens one from a pull request.
- Each page has its own URL, comments, and Diff button, which opens that page's `changes` card.
- Readers move between pages from a page list and links to the previous and next page.
- Relative links between pages, such as `[Phase 2](02-write-through.md)`, work in diffmap and on GitHub.
- `diffmap guide` tells agents to write books in `.diffmap/specs/`, and how to make each page stand on its own.

## Non-goals

- Nested directories or sections inside a book. Gists hold only flat files, and a long book can split into two books.
- Removing single-file specs.
- Turning existing single-file specs, such as [merge-generate-spec-walkthrough](../merge-generate-spec-walkthrough.md), into books.
- A search box across pages.

## Pages

1. [Read a directory as a book](01-read-a-directory.md): the page rule and `validate <dir>`.
2. [Serve each page at its own URL](02-serve-pages.md): the server and live reload.
3. [Move between pages](03-move-between-pages.md): the page list, next and previous links, and links between pages.
4. [Tell agents to write books](04-write-books.md): the guide, the README, and `.diffmap/specs/`.
5. [Share a book as a gist](05-share-a-book.md): `share <dir>` and the gist viewer.
6. [Open a book on a pull request](06-open-on-a-pull-request.md): diffmap.dev's GitHub viewer.

## References

- [[src/book.ts]] orders pages and finds them by slug, file name, or link; [[src/readBook.ts]] reads a book from disk.
- [[src/serve.ts#startServer]] reads, parses, watches, and serves the book.
- [[src/viewer/main.tsx]] loads the page the URL names and moves between pages.
- [[src/viewer/bookNav.tsx]] holds the book a page belongs to, its links, and the pager.
- [[src/share.ts#shareMarkdownFile]], [[src/gist/fetchGist.ts#loadGistMarkdown]], and [[src/gist/GistApp.tsx#GistApp]] share and load gists.
- [[src/github/route.ts#parseGitHubPath]] and [[src/github/fetchRepo.ts#loadPinnedSpec]] load specs from pull requests.
- [[guide.md]] is what `diffmap guide` prints.
