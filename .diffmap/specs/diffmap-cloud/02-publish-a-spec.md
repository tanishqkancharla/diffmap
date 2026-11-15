# Phase 1: Publish a spec

[Where it runs](01-where-it-runs.md) set out the Worker, the R2 bucket, and the D1 tables. This phase makes `diffmap share` upload a spec there and print a link anyone can open.

**Today**

`share` needs the GitHub CLI, refuses specs with local screenshots, and prints a gist link that loads from GitHub's API in the reader's browser.

**Proposed**

The person signs in once:

```text
$ npx @tanishqkancharla/diffmap login
Open https://github.com/login/device and enter 4F2A-91BC
Signed in to diffmap.dev as tanishqkancharla.
```

Then sharing a spec works like this, screenshots included:

```text
$ npx @tanishqkancharla/diffmap share .diffmap/specs/session-store/
Uploading 7 pages, 4 screenshots, 1 recording, and the diffs of 3 commits (6.2 MB)
Source files in this spec, now public:
  src/store.ts, src/session.ts, src/store.test.ts
https://diffmap.dev/s/k3v9q2xa7m
```

The link opens the cover; `/s/k3v9q2xa7m/<page-slug>` opens a page, and `#heading` a section, as gist links do. The page looks like the local viewer, without the Close server button. An agent that fetches a page with `Accept: text/markdown` gets the page's source, as from `serve`.

Signed out, `share` says to run `diffmap login` first. `share --gist` keeps today's gist behavior, and `/g/` links keep working.

## Signing in

`login` uses GitHub's device flow, which needs no browser redirect back to the CLI, so it works over SSH and in an agent's terminal. The GitHub App asks for no repository access: diffmap only needs to know who the person is. The Worker checks the GitHub token once, finds or creates the user, and returns its own random token, which the CLI keeps in `~/.config/diffmap/auth.json`, readable only by the user. The Worker stores only that token's hash. `diffmap logout` deletes the file and the token.

## Uploading

`share` already gathers what a gist needs: [[src/git.ts#readDocumentChanges]] snapshots each commit a page references, and `readDocumentFiles` in [[src/share.ts]] reads the files excerpts show. Uploading reuses both, and adds the media files that [[src/parseViewer.ts#collectMedia]] finds, instead of refusing them.

```services [Sharing a spec]
service CLI "diffmap share"
  state blobs = hashed locally
service Worker "diffmap.dev API"
service R2
service D1
  state specs = none

start "A spec is uploaded once, file by file, then named by a manifest"
  > The CLI hashes every file first, so the Worker only receives files it does not already have.

step "The CLI asks for a spec ID"
  CLI -> Worker: POST /api/specs {title}
  Worker -> D1: insert spec owned by the user
  D1.specs = k3v9q2xa7m, version 0
step "The Worker says which files it lacks"
  CLI -> Worker: POST /api/specs/k3v9q2xa7m/check {hashes}
  Worker -> CLI: missing hashes
step "The CLI uploads the missing files"
  CLI -> Worker: PUT /api/specs/k3v9q2xa7m/blobs/<sha256>
    > The Worker checks the hash, the size limits, and the media type before writing.
  Worker -> R2: put specs/k3v9q2xa7m/blobs/<sha256>
step "The CLI commits the manifest"
  CLI -> Worker: POST /api/specs/k3v9q2xa7m/versions {manifest}
  Worker -> R2: put versions/1.json
  Worker -> D1: latest_version = 1
  D1.specs = k3v9q2xa7m, version 1
  Worker -> CLI: https://diffmap.dev/s/k3v9q2xa7m
```

A version only becomes visible when its manifest is committed, and only if every hash it names is stored, so a reader never sees half an upload.

IDs are ten random lowercase letters and digits. They are not secret: a shared spec is public to anyone with the link, as an unlisted gist is. Published pages send `X-Robots-Tag: noindex`, so search engines leave them out unless the person links them somewhere public.

## The published viewer

A new `published` route beside the gist and GitHub ones in [[src/host/HostApp.tsx#HostApp]] reads the manifest from `/api/specs/<id>/versions/latest`, then each page and snapshot from `/api/specs/<id>/blobs/<sha256>`. It hands them to the viewer the way [[src/gist/GistApp.tsx#GistApp]] hands over a gist's files and snapshots. Blobs never change, so the Worker sends them with `Cache-Control: public, max-age=31536000, immutable` and Cloudflare's cache serves repeat loads. The viewer mode is `"published"`, which counts as hosted: HTML still shows a placeholder until [Phase 4](05-html-and-live-ui.md).

Nothing loads from GitHub, so GitHub's 60-an-hour limit no longer applies, and size is limited only by [the limits](01-where-it-runs.md#limits).

## The guide

[[guide.md]]'s "Serve and share" section says `share` now uploads to diffmap.dev, needs a one-time `diffmap login`, and keeps screenshots, so the advice to link media by https URL goes away. It keeps the warning that a shared spec is public, including every source file it snapshots.

```changes

```
