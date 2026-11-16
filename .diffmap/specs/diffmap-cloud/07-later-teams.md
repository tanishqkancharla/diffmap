# Later: teams

[Phases 1](02-share-dialog.md) to [5](06-definitions-and-ranges.md) let a person share a spec publicly or with people they add by email. The share dialog shows **Share with team** as "Coming soon". This page notes what teams could add and what the first version already does to leave room for them. What a team is, and how people join one, is decided when teams are next.

**Today, after Phase 5**

Each shared spec has one owner, and is Public or Restricted to a list of emails.

**Proposed, roughly**

- **Share with team.** A third access option in the dialog: everyone on the owner's team can open the link, including people who join later, without adding each one.
- **A team's specs.** A page on diffmap.dev listing the specs shared with a team.
- **Specs from CI.** A GitHub Action shares a pull request's spec on each push and comments the link on the pull request. It signs in with the GitHub Actions OIDC token, so the repo needs no stored secret, and the spec's `source` keeps one link per spec.
- **Shared comments.** Comments move from each reader's browser into D1, keyed by spec, page, and the anchors in [[src/viewer/comments.ts]], which already find a highlight again after a page changes. The spec's Durable Object from [Phase 3](04-live-link.md) sends new comments to everyone reading, as it sends new versions.

## What the first version already does for this

- Every read goes through the Worker, which already checks access for Restricted specs, so a team check is one more rule in the same place.
- `spec.access` is a column with two values today, `public` and `restricted`, so `team` is a third.
- People are identified by every verified email on their linked accounts, so a team defined by email domain, by invitation, or by GitHub org can all be checked against the same accounts.
- The link, `/s/<id>`, has no owner or team in it, so sharing a spec with a team does not change its link.
- Code from specs already runs on its own domain, and Restricted frames already use signed links, so team specs need nothing new there.
- `spec.kind` lets another kind of document share the same way, with the same dialog and access rules.

```changes

```
