# Phase 2: Update and delete

[Phase 1](02-publish-a-spec.md) uploads a spec as version 1 of a new link. This phase makes sharing again update that link, keeps earlier versions readable, and lets the owner delete a spec.

**Today**

Every `share` makes a new gist with a new link. To fix a typo, the person sends a new link and the old one keeps the mistake. Deleting means finding the gist on GitHub.

**Proposed**

Sharing the same spec again prints the same link, now showing the new version:

```text
$ npx @tanishqkancharla/diffmap share .diffmap/specs/session-store/
Updated https://diffmap.dev/s/k3v9q2xa7m to version 2 (2 pages changed, 0.3 MB uploaded)
```

The header of a shared spec says "Version 2 · updated 5 minutes ago", with a menu of earlier versions. `/s/<id>@1` always opens version 1, so a link pasted into a review keeps showing what the reviewer saw. A reader's comments and Reviewed checkboxes are saved per page, not per version, as they are locally, so they carry over when the spec updates. A Reviewed checkbox still clears when that file's diff changes ([[src/viewer/reviewed.ts#useReviewedFiles]]).

`share --new` makes a separate link instead. `diffmap list --shared` lists the person's shared specs with their links, versions, and sizes.

## Finding the link to update

`share` needs to know which link a spec directory belongs to, on any machine the person uses. Each spec record stores where it came from: the repo's `origin` remote and the spec's path in the repo, such as `github.com/acme/api` and `.diffmap/specs/session-store`. `share` asks the Worker for the person's spec with that origin and path, and updates it if there is one. A spec outside a git repo, or in a repo without a remote, falls back to its absolute path on this machine. The `specs` table gains a `source` column for this.

## Keeping versions

Each version is a manifest, and its blobs are shared with the versions before it, so a small edit costs only the files it changed. Each spec keeps its last 50 versions. A daily scheduled job deletes older manifests, then any blob no kept manifest names.

## Deleting

```text
$ npx @tanishqkancharla/diffmap share --delete https://diffmap.dev/s/k3v9q2xa7m
Deleted https://diffmap.dev/s/k3v9q2xa7m and its 2 versions.
```

`--delete` takes the link or the spec directory. The Worker marks the spec deleted at once, so every link to it answers 410 with "The owner deleted this spec." It then deletes the spec's R2 prefix and purges the spec's URLs from Cloudflare's cache. An admin taking a spec down after a report does the same.

Only the latest-version manifest can change, so it is cached for a few seconds with an `ETag`; blobs and pinned versions are cached for a year. Deleting has to purge the cache because of those long-lived entries.

```changes

```
