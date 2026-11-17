# Later: pull requests and teams

[Phases 1](02-publish-from-the-cli.md) to [7](08-definitions-and-ranges.md) let a person share a document publicly or with people they add by email. This page notes two things that come after, and what the first version already does to leave room for them. Neither is planned in detail.

**Today, after Phase 7**

A document reaches productdoc.dev only when someone shares it. A document on a pull request is still read from GitHub, at its diffmap.dev pull request link, which only works for public repos. Each shared document has one owner, and is Public or Restricted to a list of emails.

**Proposed, roughly**

## Pull requests, by upload instead of GitHub

Instead of reading a pull request's document from GitHub, CI shares it on each push. A GitHub Action runs `product-doc share` and comments the link on the pull request. It signs in with the GitHub Actions OIDC token, which proves which repo and workflow it is, so the repo needs no stored secret. The document's `source` is the repo and the document's path in it, so every push updates one link, and readers see each push live as in [Phase 4](05-live-link.md).

This works the same for private repos, since nothing loads from GitHub. Previews come from the uploaded build, as in [Phase 6](07-previews-and-html.md), instead of the pull request's preview deployment. Productdoc then needs no reader that loads from GitHub. diffmap.dev keeps its own.

## Teams

- **Share with team.** A third access option in the dialog, now shown as "Coming soon": everyone on the owner's team can open the link, including people who join later, without adding each one. For documents from CI, the team is the natural default.
- **A team's documents.** A page on productdoc.dev listing the documents shared with a team.
- **Shared comments.** Comments move from each reader's browser into D1, keyed by document, page, and the anchors in [[src/viewer/comments.ts]], which already find a highlight again after a page changes. The document's Durable Object sends new comments to everyone reading, as it sends new versions.

## What the first version already does for this

- Every read goes through the Worker, which already checks access for Restricted documents, so a team check is one more rule in the same place.
- `document.access` has two values today, `public` and `restricted`, so `team` is a third.
- People are identified by every verified email on their linked accounts, so a team defined by email domain, by invitation, or by GitHub org can be checked against the same accounts.
- `document.source` already finds one link per repo and path, which is what CI needs.
- The link, `/d/<id>`, has no owner or team in it, so sharing a document with a team does not change its link.
- `document.kind` lets a future kind of document share the same way, with the same dialog and access rules.

```changes

```
