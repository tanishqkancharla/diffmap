# ✅ Phase 4: Tell agents to write books

Phases [1](01-read-a-directory.md) through [3](03-move-between-pages.md) let diffmap read, serve, and navigate a book. This phase tells agents to write one, and where.

**Today**

[[guide.md]] said a spec is one file at `specs/<name>.md`, and a walkthrough of a pull request without a spec goes under `.diffmap/`. Phases were `###` headings in that one file.

**Proposed**

Every spec lives in `.diffmap/specs/<name>/`, committed with the code; `.diffmap/` is not in `.gitignore`. A walkthrough of a pull request goes there too, so there is one place to look. The guide's Shape section now describes a book:

- The cover holds the problem, the solution, goals, non-goals, and References. Pages do not repeat it.
- One page per phase, named `NN-<slug>.md` with two-digit numbers. The page's first heading is the phase's title with its ⏳ or ✅, which the page list shows.
- Each page is readable by someone who read the cover and skimmed the pages before it. It opens with a sentence or two that says what earlier pages built, linked, as in `[Phase 1](01-sessions-table.md) added the sessions table.` Then Today and Proposed, the walkthrough, and the `changes` fence last, as before.
- A term is defined on the page that introduces it, and later pages link back to that page.
- To insert a page, `git mv` the pages after it to new numbers. URLs and comments survive because they use the slug.
- Captures go in `media/<slug>/` inside the book.

The guide's example phase is now a page, `02-validate-request-input.md`, that opens by linking the page before it. The README gained a **Books** section with the naming rules, and its commands take a directory. `fixtures/book` is a three-page example: `npx @tanishqkancharla/diffmap fixtures/book`.

[[skills/generate-diffmap/SKILL.md]] needed no change: it loads the guide, so agents get the new instructions with the next diffmap release.

This repository's own specs moved to `.diffmap/specs/`. The earlier spec stays one file, and this one is the first book.

```changes
723f654
guide.md
README.md
src/cli.ts

ignore:
fixtures/book/README.md
fixtures/book/01-sessions-table.md
fixtures/book/02-write-through.md
.diffmap/specs/merge-generate-spec-walkthrough.md
```
