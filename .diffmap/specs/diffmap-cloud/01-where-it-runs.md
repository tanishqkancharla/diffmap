# Where it runs

The [cover](README.md) says what sharing becomes. This page covers the platform underneath it: which provider, how specs are stored, the limits, the cost, and how diffmap.dev stays safe while it hosts other people's specs. It is not a phase; the phases after it build on it.

## Cloudflare, not Vercel

diffmap.dev is a static site on Vercel today. Sharing needs four things the static site lacks: storage for files, functions for the API, a small database for records, and a way to push updates to open pages. Cloudflare has all four on one platform:

| Need | Cloudflare | Why it fits |
| --- | --- | --- |
| Files: pages, media, snapshots, built preview pages | R2 | No charge for bandwidth. Readers load the same screenshots and recordings again and again, so bandwidth would be most of the bill elsewhere. $0.015 per GB-month stored. |
| API and serving published specs | Workers, with the viewer as static assets | One Worker answers every route, so the viewer, the API, and the spec's files share the diffmap.dev origin. |
| Records: users, specs, versions | D1 | SQLite beside the Worker; enough for these tables, and for teams later. |
| Live updates | Durable Objects | One object per spec holds the WebSockets of everyone reading it and wakes only when a version arrives. |
| A separate domain for code from specs | Workers routes on `*.diffmapusercontent.com` | The free certificate covers every first-level subdomain, so each spec gets its own origin. |

Vercel could store files in Blob, but it bills bandwidth, its functions cannot hold WebSockets open, so live updates would need another service, and it has no database of its own. Moving the static site is small: the rewrites in `vercel.json` become the Worker's routes, and Workers has preview URLs per branch as Vercel does.

## Storage

Every file is stored under its SHA-256 hash, so sharing again uploads only what changed. A version is a manifest that names the hashes of everything it shows.

```text
R2 bucket diffmap-specs (private: only the Worker reads it)
  specs/<id>/blobs/<sha256>          a page, media file, snapshot, or built preview file
  specs/<id>/versions/<n>.json       the manifest of version n

D1
  users     (id, github_id, login, created_at)
  tokens    (hash, user_id, created_at, last_used_at)   the CLI's sign-ins
  specs     (id, owner_id, title, visibility, latest_version, bytes, created_at, deleted_at)
  versions  (spec_id, n, manifest_hash, bytes, created_at)
```

Blobs live under their spec, not in one shared pool, so deleting a spec deletes one prefix and never touches another spec's files. The bucket is never public. Every read goes through the Worker, which checks the spec exists, is not deleted, and, once [teams](07-later-teams.md) exist, that the reader may see it.

```ts [The manifest of one version]
type SpecVersion = {
  title: string;
  pages: { file: string; slug: string; title: string; blob: string }[];
  media: Record<string, string>; // path in the spec → blob
  changes: Record<Rev, string>; // rev → blob of its Changes snapshot
  sourceFiles: string; // blob of the files excerpts and rev-less references read
  definitions?: string; // Phase 5
  previews?: { blobs: Record<string, string> }; // Phase 4: the built preview page
};
// [!note Rev] The same `Rev` and `Changes` types `share` already writes into a gist, from src/changes.ts.
```

Splitting the changes snapshot by rev, instead of one JSON file as in a gist, means a reader downloads only the diffs of the page they open.

## Limits

These keep one person from filling the bucket, and keep a page fast to open:

- 25 MB per file, so a short recording fits but a long screen capture does not.
- 200 MB per spec version, counting built preview pages.
- 2 GB per person across all their specs.
- 30 new links an hour per person, and at most one new version every two seconds per spec, which is the pace of [`--watch`](04-live-updates.md).
- Media must be an image or video type diffmap already renders. The Worker sends it with that type and `X-Content-Type-Options: nosniff`, so an "image" cannot run as a page.

`share` checks these before uploading and says which file is over, so the agent can shrink it.

## Cost

At a few thousand shared specs averaging 20 MB, storage is about 60 GB, under $1 a month. Reads cost $0.36 per million after the first ten million each month, and bandwidth costs nothing. The Workers paid plan is $5 a month and includes the Worker, D1, and Durable Objects at this size. The bill stays near $5 a month until diffmap is far larger than it is.

## Security

diffmap.dev will host specs from anyone who signs in. Three rules keep that safe:

1. **No code from a spec runs on diffmap.dev.** The published viewer treats HTML as hosted viewers do today ([[src/viewer/Fence.tsx#Fence]] shows a placeholder when `useViewerMode()` is not `"local"`). [Phase 4](05-html-and-live-ui.md) runs HTML and preview pages in frames on `<id>.diffmapusercontent.com` instead, a different site, so their script cannot read diffmap.dev's cookies or storage. diffmapusercontent.com goes on the Public Suffix List, so one spec's subdomain cannot set cookies for another's.
2. **Pages on diffmapusercontent.com only open inside diffmap.dev.** The Worker answers them only when the browser says it is loading a frame (`Sec-Fetch-Dest: iframe`), and sends `frame-ancestors https://diffmap.dev`. Someone who uploads a fake bank login cannot send people straight to it.
3. **Sharing publishes code, so `share` says what it uploads.** It lists every source file it will snapshot, refuses files git ignores, such as `.env`, and refuses files that look like they hold keys (private keys, cloud credentials, tokens), naming the file and line. The person can remove the file from the spec, or pass `--allow-file <path>` for one they have checked.

Every published page has a **Report** link. A report goes to an admin queue, and an admin can take a spec down, which marks it deleted and removes its files, as [Phase 2](03-update-and-delete.md)'s delete does.

diffmap.dev also sends a `Content-Security-Policy` that allows only its own scripts, and `frame-ancestors 'none'`, so a rendering bug cannot become a way to run a stranger's script, and no other site can frame diffmap.dev.
