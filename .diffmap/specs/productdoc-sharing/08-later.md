# Later: teams and CI

Not planned in detail.

**Today, after Phase 6:** each document has one owner, and is Public or Restricted to emails.

**Proposed, roughly**

- **Share with team:** a third access option, now "Coming soon" in the dialog. `document.access` gains `team`.
- **A Report button** on shared pages, if abuse email isn't enough.
- **A team's documents:** a page on productdoc.dev listing them.
- **Shared comments:** comments move into D1 and arrive live through the document's Durable Object. The anchors in [[src/viewer/comments.ts]] already survive page edits.
- **CI publishing:** a workflow runs `product-doc publish` on push with `PRODUCTDOC_TOKEN`, catching edits nobody published. This needs no GitHub app.

## Todos

- [ ] Decide how a team is defined: email domain, invitation, or GitHub org

```changes

```
