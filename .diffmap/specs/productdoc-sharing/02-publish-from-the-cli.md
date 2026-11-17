# Phase 1: Publish from the CLI

The first version. An agent runs one command and gets a public link that shows the whole document with the sharing machine turned off.

**Today:** `product-doc share` ([[src/share.ts#shareMarkdownFile]]) makes a gist through `gh`, refuses screenshots and recordings, and the reader hits GitHub's limit of 60 loads an hour.

**Proposed**

```text
$ npx product-doc share .diffmap/specs/session-store/
Sign in at https://productdoc.dev/device?code=4F2A-91BC
Uploading 7 pages, 4 screenshots, 1 recording, and 3 commits of diffs (6.2 MB)
Now public: src/store.ts, src/session.ts, src/store.test.ts
https://productdoc.dev/d/k3v9q2xa7m
```

- First run: sign in by device code with Google or GitHub.
- The upload includes pages, media, diff snapshots ([[src/git.ts#readDocumentChanges]]), and source files.
- Sharing writes `.productdoc.json` (the link) into the document folder. Sharing again replaces the link until [Phase 3](04-keep-the-link-current.md).
- `/d/<id>` renders with the hosted viewer ([[src/host/HostApp.tsx#HostApp]]). Previews and HTML show placeholders until [Phase 5](06-previews-and-html.md).
- `product-doc share --stop` deletes the link.

```callstack [Sharing]
link = shareDocument(dir)
├── bundle = pages + media + diff snapshots + source files
├── check limits, gitignored files, and keys
├── id = POST /api/documents
├── PUT /api/documents/{id}/blobs/{sha256} for each missing blob
├── POST /api/documents/{id}/versions {manifest}
└── write dir/.productdoc.json {link}
```

## Todos

- [ ] Move productdoc.dev to a Cloudflare Worker serving the website
- [ ] R2 bucket, and D1 `document` and `document_version` tables
- [ ] Better Auth: Google, GitHub, account linking, device authorization, bearer tokens
- [ ] `product-doc login` and `logout`
- [ ] Upload API: create, upload blobs, commit a version
- [ ] `product-doc share`, with the limit and secret checks, writing `.productdoc.json`
- [ ] `/d/<id>` in the hosted viewer, with Markdown for agents
- [ ] `share --stop`, the Report link, and admin takedown
- [ ] Update the guide's sharing section

```changes

```
