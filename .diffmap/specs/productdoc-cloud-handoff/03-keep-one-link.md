# ✖️ Declined: keep one link when you share again

**Declined November 20.** Only Tanishq shares for now, so a new link on each share is fine. Revisit with publishing for everyone.

[Phase 2](02-sign-in-and-proof.md) turned on sign-in, so `share` uploads a folder and writes its link into the folder's `.productdoc.json`. This phase makes sharing the same folder again update that link instead of making a new one.

**Today:** every `share` makes a new link. You fix a page, share again, and the people you sent the first link still see the old version. Cursor planned it this way as a stopgap ("Sharing again replaces the link until Phase 3"); its Phase 3 is a much larger design with `publish`, `pull`, version links like `/d/<id>@3`, and live reload.

**Proposed:** if the folder already has a link, `share` adds a new version to it. Anyone with the link sees the new version the next time they open it. If you stopped that link, `share` makes a new one, as it does today.

```ts
// product-doc share <dir>, sharing the same folder twice
await share(".diffmap/specs/sessions/");
// today:    https://share.productdoc.dev/d/a1b2c3d4e5, then …/d/f6g7h8i9j0
// proposed: https://share.productdoc.dev/d/a1b2c3d4e5, both times (version 2)
```

The server already supports this. Each document has numbered versions, readers get the latest, and [[src/cloud/documents.ts#commitVersion]] adds one to a document you own, refusing with 409 once it's stopped. Only the CLI's [[src/publish/share.ts#shareDocument]] changes:

```callstack [Sharing a folder that already has a link]
 result = shareDocument(dir) [[src/publish/share.ts#shareDocument]]
+├── saved = readLinkFile(dir) # .productdoc.json from the last share
-├── id = POST /api/documents
+├── id = saved?.id ?? POST /api/documents
 ├── upload the files the server doesn't have yet
 ├── version = POST /api/documents/{id}/versions [[src/cloud/documents.ts#commitVersion]]
+├── if saved and the link is stopped, removed, or not yours:
+│   └── id = POST /api/documents, upload, commit version 1 # a new link, as today
 ├── write { id, link } to .productdoc.json
 └── return { id, link, version }
```

Uploads only send files the server doesn't already have for that link, so sharing a one-line fix sends one page, not the whole folder again.

## Expected flows

1. Share a folder for the first time: you get a new link, version 1.
2. Edit a page and share again: same link, version 2. A browser that had it open shows the edit after a reload.
3. `share --stop`, then `share`: a new link, because the old one is stopped.
4. A folder whose `.productdoc.json` points at a link that no longer exists, or that you don't own: a new link, and the file is rewritten.

**Not included:** old versions stay stored but readers can't open them yet; that's Cursor's version-link design. There's no flag to force a new link; stop the old one first.

## Proof

Against the live deployment: share this plan twice and show the link unchanged, with the second share's edit on the page. Then stop it and share again, showing a new link. Typecheck, lint, and the full test suite must pass, with a test for each flow above in `src/publish/share.test.ts`.

```changes

```
