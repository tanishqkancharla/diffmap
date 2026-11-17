# Phase 1: The share dialog

[Where it runs](01-where-it-runs.md) set up the Worker, R2, D1, and Better Auth. This phase adds the **Share** button and dialog to the local viewer, signs the person in, and shares a document publicly. Agents get the same through `product-doc share`. [Phase 2](03-restricted-and-invites.md) adds Restricted access to the same dialog.

**Today**

The local viewer's header has the document's title, the Diff button, and Close server ([[src/viewer/ViewerApp.tsx#ViewerApp]]). There is no way to share from it. `product-doc share` makes a gist through the GitHub CLI and refuses documents with local screenshots.

**Proposed**

The header gains a quiet **Share** button between the Diff button and Close server. It opens the dialog:

```text [The share dialog, sharing for the first time]
┌──────────────────────────────────────────────┐
│ Share "Session store"                      × │
│ ┌──────────────────────────────────────────┐ │
│ │ ● ● ●   productdoc.dev                      │ │
│ │ (the document's cover, as it will look)      │ │
│ └──────────────────────────────────────────┘ │
│ Access                                       │
│ [ Public: Anyone with the link has access ▾ ]│
│ ☑ Keep this link updated                     │
│ Share with team                  Coming soon │
│ 3 source files become public: src/store.ts…  │
│                                              │
│ [ Copy link ]                      [ Share ] │
└──────────────────────────────────────────────┘
```

- Clicking **Share** for the first time opens a popup to sign in with Google or GitHub, then uploads. The button reads **Sharing…** with progress, then the dialog shows the link with **Copy link** and the main button becomes **Done**.
- If the upload fails, the dialog says why, such as "recording.mp4 is 41 MB; the limit is 25 MB", and the button reads **Retry**.
- Opening the dialog on a document already shared shows its link, its access, and when it last updated.
- The line about source files lists every file the share makes public, and expands to the full list.

Agents share from the CLI:

```text
$ npx product-doc share .diffmap/specs/session-store/
Sign in at https://productdoc.dev/device?code=4F2A-91BC
Uploading 7 pages, 4 screenshots, 1 recording, and the diffs of 3 commits (6.2 MB)
Source files in this document, now public: src/store.ts, src/session.ts, src/store.test.ts
https://productdoc.dev/d/k3v9q2xa7m
```

`share --gist` keeps today's gist behavior for a while, and `/g/` links keep working.

## Signing in from the viewer and the CLI

The local viewer may run on a remote VM, opened through a forwarded port, so productdoc.dev cannot redirect back to it. Both the viewer and the CLI use Better Auth's device authorization instead. The local server, or the CLI, asks productdoc.dev for a code, and the person approves it in their browser while signed in to productdoc.dev:

```services [Signing in from the share dialog]
service Dialog "share dialog in the local viewer"
service Serve "product-doc serve"
  state token = none
service Auth "productdoc.dev: Better Auth"

start "The person signs in once, and the local server keeps the token"
  > The token goes to the local server, never to the page, so it is not exposed to the document's content.

step "The dialog asks the local server to sign in"
  Dialog -> Serve: POST /__diffmap/auth/start
  Serve -> Auth: POST /device/code
  Auth -> Serve: device_code, verification_uri_complete
  Serve -> Dialog: verification_uri_complete
step "The person approves in a popup"
  Dialog -> Auth: open /device?code=4F2A-91BC
    > They sign in with Google or GitHub if needed, check the code matches the one in the dialog, and approve.
step "The local server picks up the token"
  Serve -> Auth: POST /device/token (polling)
  Auth -> Serve: session token
  Serve.token = saved to ~/.config/product-doc/auth.json
  Serve -> Dialog: signed in as Tanishq
```

The CLI does the same, printing the link instead of opening a popup. Both share `~/.config/product-doc/auth.json`, readable only by the user, so signing in once covers both. `product-doc logout` deletes it and revokes the session.

The local server only accepts these requests from its own page. They are JSON `POST`s, which need a CORS preflight that `serve` never grants, as `/__diffmap/telemetry` already relies on in [[src/serve.ts]].

## Uploading

`share` already gathers what a gist needs: [[src/git.ts#readDocumentChanges]] snapshots each commit a page references, and `readDocumentFiles` in [[src/share.ts]] reads the files excerpts show. Uploading reuses both, and adds the media files [[src/parseViewer.ts#collectMedia]] finds instead of refusing them. The dialog and the CLI call the same function; the dialog reaches it through a new `POST /__diffmap/share` on the local server.

```callstack [Sharing a document]
link = shareSpec(documentDir, access) # called by the CLI, or by serve for the dialog
├── pages = parseSpec(readSpec(documentDir)) [[src/readSpec.ts#parseSpec]]
├── bundle = collect pages, media, changes snapshots, source files
├── check bundle against the limits and the secret checks
├── hashes = sha256 of every file
├── id = POST /api/documents {title, access, source} # or the existing link's id
├── missing = POST /api/documents/{id}/check {hashes}
├── PUT /api/documents/{id}/blobs/{sha256} for each missing file
└── return POST /api/documents/{id}/versions {manifest}
```

A version becomes visible only when its manifest is committed, and only if every file it names is stored, so a reader never sees half an upload. The document record's `source` holds the repo's `origin` remote and the document's path in it, so sharing the same document from another machine finds the same link.

## The shared viewer

`https://productdoc.dev/d/<id>` opens the cover, `/d/<id>/<page-slug>` a page, and `#heading` a section, as gist links do. A new route beside the gist and GitHub ones in [[src/host/HostApp.tsx#HostApp]] reads the version's manifest, then each page and snapshot, and hands them to the viewer as [[src/gist/GistApp.tsx#GistApp]] hands over a gist. The page looks like the local viewer, without Close server. Its header shows the owner and, for the owner, a **Share** button that opens the same dialog. An agent that fetches a page with `Accept: text/markdown` gets its source, as from `serve`.

Nothing loads from GitHub, so GitHub's rate limit no longer applies. Public shared pages send `X-Robots-Tag: noindex`, so search engines leave them out unless someone links them publicly.

## The guide

[[guide.md]]'s "Serve and share" section says `share` uploads to productdoc.dev, asks the person to sign in the first time, and keeps screenshots, so the advice to link media by https URL goes away. It keeps the warning that a public link is readable by anyone who has it, including every source file it includes.

```changes

```
