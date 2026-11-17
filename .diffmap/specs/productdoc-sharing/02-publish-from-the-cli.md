# Phase 1: Publish from the CLI

[Where it runs](01-where-it-runs.md) chose the platform. This phase is the smallest version worth shipping: an agent runs `product-doc share`, signs in once, and gets a public link at productdoc.dev that shows the whole document, screenshots and diffs included, with the sharing machine turned off. Every later phase builds on what this one stands up.

**Today**

`product-doc share` ([[src/share.ts#shareMarkdownFile]]) makes a gist through the GitHub CLI and prints a diffmap.dev link. It needs `gh` signed in, refuses documents with local screenshots or recordings, and the reader loads the gist from GitHub's API, 60 loads an hour per network.

**Proposed**

```text
$ npx product-doc share .diffmap/specs/session-store/
Sign in at https://productdoc.dev/device?code=4F2A-91BC
Signed in as tanishq@example.com
Uploading 7 pages, 4 screenshots, 1 recording, and the diffs of 3 commits (6.2 MB)
Source files in this document, now public: src/store.ts, src/session.ts, src/store.test.ts
https://productdoc.dev/d/k3v9q2xa7m
```

The link is public, and shows the document as `product-doc serve` does. Each share makes a new link; [Phase 3](04-one-link-per-document.md) makes sharing again update the same one. `product-doc share --stop <link>` deletes a link, so a mistaken share can be undone from the start. `share --gist` keeps today's behavior for a while.

## Signing in

The CLI may run on a remote VM, so productdoc.dev cannot redirect back to it. It uses Better Auth's device authorization instead: the CLI asks productdoc.dev for a code, prints a link with the code filled in, and polls until the person approves it in their browser, signed in with Google or GitHub.

```services [Signing in from the CLI]
service CLI "product-doc share"
  state token = none
service Auth "productdoc.dev: Better Auth"
service Browser "the person's browser"

start "The person signs in once, and the CLI keeps the token"
  > Google and GitHub accounts with the same verified email become one account, so either sign-in works later.

step "The CLI asks for a code"
  CLI -> Auth: POST /device/code
  Auth -> CLI: device_code, verification_uri_complete
step "The person approves it"
  Browser -> Auth: open /device?code=4F2A-91BC, sign in, approve
step "The CLI picks up the token"
  CLI -> Auth: POST /device/token (polling)
  Auth -> CLI: session token
  CLI.token = saved to ~/.config/product-doc/auth.json
```

The token file is readable only by the user. `product-doc logout` deletes it and revokes the session.

## Uploading

`share` already gathers what a gist needs: [[src/git.ts#readDocumentChanges]] snapshots each commit a page references, and `readDocumentFiles` in [[src/share.ts]] reads the files excerpts show. Uploading reuses both, and adds the media files [[src/parseViewer.ts#collectMedia]] finds instead of refusing them.

```callstack [Sharing a document]
link = shareDocument(documentDir)
├── pages = parseSpec(readSpec(documentDir)) [[src/readSpec.ts#parseSpec]]
├── bundle = collect pages, media, changes snapshots, source files
├── check bundle against the limits and the secret checks
├── hashes = sha256 of every file
├── id = POST /api/documents {title}
├── missing = POST /api/documents/{id}/check {hashes}
├── PUT /api/documents/{id}/blobs/{sha256} for each missing file
└── return POST /api/documents/{id}/versions {manifest}
```

A link answers only once its manifest is committed, and only if every file it names is stored, so a reader never sees half an upload. The checks before uploading, the limits, and the secret scan are in [Where it runs](01-where-it-runs.md#limits).

## The shared viewer

`https://productdoc.dev/d/<id>` opens the cover, `/d/<id>/<page-slug>` a page, and `#heading` a section, as gist links do. A new route beside the gist and GitHub ones in [[src/host/HostApp.tsx#HostApp]] reads the manifest, then each page and snapshot, and hands them to the viewer as [[src/gist/GistApp.tsx#GistApp]] hands over a gist. It looks like the local viewer, without Close server, and has a **Report** link. HTML and preview blocks show placeholders until [Phase 6](07-previews-and-html.md). An agent that fetches a page with `Accept: text/markdown` gets its source, as from `serve`.

Public pages send `X-Robots-Tag: noindex`, so search engines leave them out unless someone links them publicly.

## Todos

- [ ] Move productdoc.dev's DNS to Cloudflare, and serve the website's pages from the Worker
- [ ] Create the R2 bucket and D1 database, with the `document` and `document_version` tables
- [ ] Run Better Auth in the Worker with Google, GitHub, account linking, device authorization, and bearer tokens
- [ ] `product-doc login`, `logout`, and the token file
- [ ] Upload API: create a document, check hashes, upload blobs, commit a version
- [ ] `product-doc share` uploads pages, media, diffs, and source files, after the limit and secret checks
- [ ] `product-doc share --stop`, and the Report link with admin takedown
- [ ] The `/d/<id>` route in the host viewer, with Markdown for agents
- [ ] The guide's "Serve and share" section: `share` uploads to productdoc.dev and keeps screenshots
- [ ] Tests for upload, the limits, the secret scan, and the shared route

```changes

```
