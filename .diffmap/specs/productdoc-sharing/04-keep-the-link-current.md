# Phase 3: Keep the link current

The Notion feel: once shared, the link shows the latest edits, and nobody gets stuck on an old snapshot. Files stay the source of truth, and productdoc.dev acts like a git remote.

**Today, after Phase 2:** each share replaces the link, and readers see a snapshot.

**Proposed**

```json [.diffmap/specs/session-store/.productdoc.json]
{
  "link": "https://productdoc.dev/d/k3v9q2xa7m",
  "version": 7
}
// [!note L3] The version these files were last published or pulled as.
```

- **The folder remembers.** `.productdoc.json` is committed with the document, so any agent on any machine sees it's shared. Agents need no memory or skill state.
- **`product-doc publish`** validates, then uploads changed files as a new version. Once a document is shared, agents run it instead of `validate`.
- **`validate` nudges.** On a shared document it passes, then says `2 pages differ from the link. Run product-doc publish.`
- **`serve` publishes on save** while it runs.
- **Two agents at once.** `publish` refuses when the link has moved past the folder's version, and says to run `pull`. `pull` writes the newer pages into the folder, and git merges them. Nothing is overwritten silently.
- **Readers** see changed pages reload in place, through a Durable Object per document. Each version keeps its own link, `/d/<id>@3`. The last 50 are kept.
- **Not covered:** an edit made without running productdoc publishes the next time anyone runs productdoc on the document. A fresh machine needs a sign-in approval, or `PRODUCTDOC_TOKEN`.

## Expected flows

**Your agent keeps the link current**

1. You shared a document, and your teammate has the link open.
2. You ask your agent to change a page. When it's done, it publishes.
3. The page your teammate is reading updates in place. They keep their place and their comments.

**A new agent picks up the document**

1. A week later, a different agent on another machine is asked to update the document.
2. After editing, it checks the document. productdoc tells it the document is shared and needs publishing.
3. It publishes. If that machine isn't signed in, you get a sign-in link to approve first.

**The viewer shows the link is behind**

1. An agent edited two pages but didn't publish.
2. You open the document locally. The header reads **Shared · 2 to publish**.
3. You open the dialog and click **Publish 2 edits**. The header goes back to **Shared**.

```preview [The header button]
share-header-button--shared
share-header-button--unpublished
```

```flow [Publishing from the dialog]
share-dialog--unpublished-edits
  share-dialog--publishing: Click "Publish 2 edits"
    share-dialog--published: The upload finishes
```

**Two agents edit at once**

1. Two agents on different machines both edit the document. The first one publishes.
2. The second one's publish stops, and says someone else published first.
3. It pulls their changes, sees them in git, merges, and publishes. Both sets of edits are on the link.

**A reader looks at an earlier version**

1. A reviewer opens the link. The header says when it last updated.
2. They open the versions menu and pick version 6. The page says they're on an older version.
3. They paste that version's link into a review. It keeps showing version 6, even after later edits.

```flow [Looking at an earlier version]
share-shared-page--with-versions
  share-shared-page--versions-open: Click "Updated 5 minutes ago"
    share-shared-page--old-version: Pick version 6
```

**Sharing a document that's already shared**

1. You ask an agent to share a document that's already shared.
2. It publishes to the same link, instead of making a new one.

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

```changes

```
