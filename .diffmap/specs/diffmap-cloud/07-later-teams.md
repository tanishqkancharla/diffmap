# Later: teams

[Phases 1](02-publish-a-spec.md) to [5](06-definitions-and-ranges.md) make sharing public specs as good as `serve`. This page sketches what teams add, so the first version leaves room for it. It is not planned in detail; each part becomes its own phase when teams are next.

**Today, after Phase 5**

Every shared spec is public to anyone with its link. Each has one owner, a person signed in with GitHub.

**Proposed**

A person shares a spec with their team, and only members can open the link. Pull requests in a team's repos get a shared spec automatically, and reviewers' comments are shared with each other.

## Teams are GitHub orgs

A team is a GitHub org that has installed the diffmap GitHub App with one permission, reading org members. Everyone in the org is on the team, with no invites to manage, and someone who leaves the org loses access when GitHub says so. `share --team acme` shares with the `acme` org. When a repo's `origin` is in an org that has the app installed, `share` defaults to that team instead of public, so company code is not published by mistake; `--public` overrides it.

## Reading a team spec

A team spec needs the reader signed in on diffmap.dev, not only in the CLI. Signing in on the web uses the same GitHub App, and keeps the session in an `HttpOnly` cookie on diffmap.dev. On each request for a team spec, the Worker checks the reader is in the org, caching GitHub's answer for a few minutes. Team blobs are sent `Cache-Control: private`, so Cloudflare's shared cache never holds them.

HTML and preview frames on diffmapusercontent.com cannot read diffmap.dev's cookie. For a team spec, diffmap.dev gives the frame a short-lived signed link, which sets a `Partitioned` cookie for that spec's subdomain, so the frame works inside diffmap.dev and nowhere else.

## Specs from CI

A GitHub Action runs `diffmap share` on each push to a pull request that has a spec, and comments the link on the pull request. It signs in with the GitHub Actions OIDC token, which proves which repo and workflow it is, so the repo needs no stored secret. The spec's `source` is the repo and spec path, as in [Phase 2](03-update-and-delete.md), so every push updates one link.

## Shared comments

Comments move from each reader's browser into a D1 table, keyed by spec, page, and the anchors in [[src/viewer/comments.ts]], which already find a highlight again by its quote and surrounding text after a page changes. The spec's Durable Object from [Phase 3](04-live-updates.md) sends new comments to everyone reading, as it sends new versions.

## What the first version already does for this

- Every read goes through the Worker, and the bucket is private, so access checks need no change to storage.
- Every spec has an owner and a `visibility` column from Phase 1, which only ever holds `public` until teams.
- Code from specs already runs on its own domain, so diffmap.dev can hold sign-in cookies safely.
- The link format, `/s/<id>`, has no owner or team name in it, so moving a spec to a team does not change its link.
- Sign-in already uses a GitHub App, which teams extend with one org permission instead of a new kind of sign-in.

```changes

```
