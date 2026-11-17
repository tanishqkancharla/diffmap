# Phase 3: Keep the link current

The Notion feel: once shared, the link shows the latest edits, and nobody gets stuck on an old snapshot. Files stay the source of truth, and productdoc.dev acts like a git remote.

**Today, after Phase 2:** each share replaces the link, and readers see a snapshot.

**Proposed**

## The document folder remembers

```json [.diffmap/specs/session-store/.productdoc.json]
{
  "link": "https://productdoc.dev/d/k3v9q2xa7m",
  "version": 7
}
// [!note L3] The version these files were last published or pulled as.
```

- It's committed with the document, so a new agent on another machine sees the document is shared.
- Agents don't need memory or skill state. The file, and the commands that read it, tell them.

## Publishing

- `product-doc publish [dir]` validates, then uploads changed files as a new version. Agents run it instead of `validate` once a document is shared.
- `validate` on a shared document passes, then says: `Shared at productdoc.dev/d/k3v9q2xa7m. 2 pages differ from the link. Run product-doc publish.`
- `publish` on an unshared document says to run `share` first.
- `serve` publishes on save while it runs, and shows how far behind the link is:

```preview [The header when the link is behind]
share-header-button--shared
share-header-button--unpublished
```

```flow [Publishing from the dialog]
share-dialog--unpublished-edits
  share-dialog--publishing: Click "Publish 2 edits"
    share-dialog--published: The upload finishes
```

## Two agents at once

- `publish` refuses when the link has moved past the folder's version, and says to run `pull`.
- `pull` writes the link's pages into the folder, so `git diff` shows what changed. There's no custom merge.
- Nothing is overwritten silently.

## Readers

- Open copies of the link reload changed pages through the document's Durable Object, keeping scroll and comments.
- "Updated 5 minutes ago", with a menu of earlier versions. `/d/<id>@3` pins version 3.
- 50 versions are kept.

## What's not covered

- Edits made without running productdoc (a hand edit, then a commit) publish the next time anyone runs productdoc on the document.
- A fresh machine needs a sign-in approval, or `PRODUCTDOC_TOKEN`.

## Todos

- [ ] `.productdoc.json` with link and version, written by `share`, `publish`, and `pull`
- [ ] `product-doc publish`: validate, upload changed files, refuse when the link has moved on
- [ ] `product-doc pull`
- [ ] `validate` reports how far behind the link is
- [ ] `serve` publishes on save, and the header's "to publish" state
- [ ] Publish button in the dialog
- [ ] A Durable Object per document, and the shared viewer reloading changed pages
- [ ] `/d/<id>@<n>`, the versions menu, and pruning to 50 versions
- [ ] `PRODUCTDOC_TOKEN`
- [ ] Guide and skill: once shared, finish edits with `product-doc publish`
- [ ] Tests: two machines publishing, pull then publish, burst of saves

```changes

```
