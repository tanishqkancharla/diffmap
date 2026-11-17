# Phase 3: One link per document

[Phase 2](03-share-from-the-viewer.md) shares from the viewer, and like [Phase 1](02-publish-from-the-cli.md) each share makes a new link. This phase gives each document one link: sharing again uploads a new version to it, earlier versions stay readable, and the owner can stop sharing from the dialog.

**Today, after Phase 2**

Sharing the same document twice gives two links, and a reader with the first one never sees the fix.

**Proposed**

Sharing a document that already has a link uploads a new version to that link. The dialog on a shared document shows the link and when it last updated:

```preview [The dialog on a document already shared]
share-dialog--shared-again
```

## Finding the link

The `document` record's `source` holds the repo's `origin` remote and the document's path in it. Sharing looks the source up for the signed-in owner, so sharing the same document from the CLI, the viewer, or another machine finds the same link. A document outside a git repo, or with no remote, keeps its link in `serve`'s own state for that directory.

## Versions

Each upload is a version, and shares its unchanged files with the version before it, so sharing again after a one-line fix uploads one page. The shared viewer's header says "Updated 5 minutes ago", with a menu of earlier versions. `/d/<id>@3` always opens version 3, so a link pasted into a review keeps showing what the reviewer saw. A reader's comments and Reviewed checkboxes are saved per page, not per version, so they carry over; a Reviewed checkbox still clears when that file's diff changes ([[src/viewer/reviewed.ts#useReviewedFiles]]).

Each document keeps its last 50 versions. A daily scheduled job deletes older manifests, then any file no kept manifest names.

## Stop sharing

The dialog's access menu ends with **Stop sharing**, as does `product-doc share --stop <dir or link>` from Phase 1. The Worker marks the document deleted at once, so the link answers "The owner stopped sharing this document." It then deletes the document's files from R2 and purges its URLs from Cloudflare's cache. `product-doc list --shared` lists the person's shared documents with their links and sizes.

## Todos

- [ ] Look documents up by `source` for the owner, and fall back to `serve`'s state outside git
- [ ] Upload only the files a new version changes
- [ ] `/d/<id>@<n>` routes, and the versions menu in the shared viewer's header
- [ ] The daily job that prunes old versions and unused files
- [ ] **Stop sharing** in the dialog's access menu
- [ ] `product-doc list --shared`
- [ ] Tests for sharing again from another machine, and for pruning

```changes

```
