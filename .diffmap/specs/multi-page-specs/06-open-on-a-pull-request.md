# ✅ Phase 6: Open a spec on a pull request

[Phase 4](04-tell-agents.md) put every spec in `.diffmap/specs/<name>/`, committed with the code, so a pull request carries all its pages. This phase opens them on diffmap.dev, with the page list and links from [Phase 3](03-move-between-pages.md).

**Today**

`https://diffmap.dev/<owner>/<repo>/pull/<n>/<path>` required `<path>` to end in `.md`, and the loader failed with "is a directory at this commit" when it named a directory.

**Proposed**

`…/pull/<n>/.diffmap/specs/session-store/` opens the spec's cover. As before, a pull request URL pins to the pull request's head commit, so the address settles on `…/commit/<sha>/.diffmap/specs/session-store/README.md`, and every other page is its file at that commit. A commit never renames a file, so these URLs keep file names rather than the slugs the local and gist viewers use, and they match the paths GitHub shows. A link copied from GitHub's file view, such as `…/02-write-through.md`, opens that page with the rest of its spec.

[[5e341e7:src/github/fetchRepo.ts#L128-L163]] decides what a path is:

```callstack [loadPinnedPage]
 page = loadPinnedPage(pin, path) [[5e341e7:src/github/fetchRepo.ts#L132-L163]]
 ├── if path has no extension: # a spec's directory
 │   ├── book = fetchPinnedBook(pin, path)
 │   └── return its cover
 ├── if the file is named like a page (README.md or NN-*.md):
 │   ├── book = fetchPinnedBook(pin, dir) # one listing per commit, then cached
 │   └── if the directory is a spec with this file: return the page with its spec
 └── return fetchPinnedBlob(pin, path) # any other spec, alone, as before
```

[[5e341e7:src/github/fetchRepo.ts#L165-L230]] lists the directory once with the contents API, then reads every page from `raw.githubusercontent.com`, which has no API rate limit. A file that is not named like a page, such as `spec.md`, never lists its directory, so a single-file spec costs no extra API call. The route accepts a path without an extension as a directory, and still rejects other files, such as `src/cli.ts` ([[5e341e7:src/github/route.ts#L148-L151]]).

Moving to another page pushes its commit URL. That page loads as a commit, which on its own has no pull request, so [[5e341e7:src/github/GitHubApp.tsx#L238-L250]] remembers the pull request each commit was pinned from, and the header's PR link and the Diff button's pull request diff stay on every page.

`src/github/fetchRepo.test.ts` checks that a directory opens its cover with the pages in order, that a page file opens with its spec with no further request, and that a single-file spec from before [Phase 7](07-directories-only.md) opens alone without listing its directory. I also checked the hosted viewer in a browser with GitHub stubbed: a pull request URL settled on the cover's commit URL, and the PR link stayed after moving to Phase 1.

```changes
5e341e7
src/github/fetchRepo.ts
src/github/GitHubApp.tsx
src/github/route.ts
src/book.ts
src/github/fetchRepo.test.ts
src/github/route.test.ts
README.md
```
