# Where it runs

The [cover](README.md) describes the share dialog. This page covers the platform underneath it: the provider, sign-in, storage, limits, cost, and how diffmap.dev stays safe while it hosts other people's specs. It is not a phase; the phases after it build on it.

## Cloudflare

diffmap.dev is a static site on Vercel today. Sharing needs what a static site lacks: storage for files, functions for the API and sign-in, a database, a way to push updates to open pages, and email for invitations. Cloudflare has all of them on one platform, billed together:

| Need | Cloudflare | Why it fits |
| --- | --- | --- |
| Files: pages, media, snapshots, built preview pages | R2 | No charge for bandwidth. Readers load the same screenshots, recordings, and preview bundles again and again, so bandwidth would be most of the bill elsewhere. $0.015 per GB-month stored. |
| API, sign-in, and serving shared specs | Workers, with the viewer as static assets | One Worker answers every route, so the viewer, the API, and the sign-in cookies share the diffmap.dev origin. |
| Accounts, specs, versions, access | D1 | SQLite beside the Worker. Better Auth runs on it. |
| Live updates | Durable Objects | One object per spec holds the WebSockets of everyone reading it and wakes only when a version arrives. |
| Invitations | Email Sending | Sends from the Worker through a binding, with no API key to manage. |
| A separate domain for code from specs | Workers routes on `*.diffmapusercontent.com` | The free certificate covers every first-level subdomain, so each spec gets its own origin. |

On Vercel, Blob storage bills bandwidth, functions cannot hold WebSockets open, and the database and email would be third-party services. Moving the static site is small: the rewrites in `vercel.json` become the Worker's routes, and Workers has preview URLs per branch, as Vercel does.

## Sign-in

The Worker runs [Better Auth](https://www.better-auth.com) on D1 with three plugins:

- **Google and GitHub** as social providers. A person can sign in with either.
- **Account linking.** Signing in with Google and later with GitHub, under the same verified email, joins both to one account. Google and GitHub are trusted providers, since both verify email addresses. From the account menu, a person can also link a GitHub account whose email differs, so invitations to either address reach them.
- **Device authorization**, for the CLI and the local viewer. Neither can receive a redirect from diffmap.dev, since the local viewer may be on a remote VM behind a forwarded port. [Phase 1](02-share-dialog.md) describes the flow. It returns a Better Auth session token, which the **bearer** plugin accepts on API requests.

Browsers on diffmap.dev keep Better Auth's session in an `HttpOnly`, `SameSite=Lax` cookie.

## Storage

Every file is stored under its SHA-256 hash, so sharing again uploads only what changed. A version is a manifest that names the hashes of everything it shows.

```text
R2 bucket diffmap-specs (private: only the Worker reads it)
  specs/<id>/blobs/<sha256>          a page, media file, snapshot, or built preview file
  specs/<id>/versions/<n>.json       the manifest of version n

D1
  Better Auth's tables: user, account, session, verification, deviceCode
  user_email    (user_id, email)                         every verified email of a user, from each linked account
  spec          (id, owner_id, kind, title, access, source, latest_version, bytes, created_at, deleted_at)
  spec_member   (spec_id, email, invited_by, invited_at)  who a Restricted spec is shared with
  spec_version  (spec_id, n, manifest_hash, bytes, created_at)
```

- `access` is `public` or `restricted`, as in Halo's `AppAccess`. Teams later add a third value.
- `kind` is `diffmap` for now. Another kind of document stores its files the same way and only changes how the viewer draws them.
- `spec_member` holds emails, not user IDs, so a person can be added before they have an account. Access checks match against `user_email`.

Blobs live under their spec, not in one shared pool, so stopping sharing deletes one prefix and never touches another spec's files. The bucket is never public. Every read goes through the Worker, which checks the spec exists and the reader may see it.

```ts [The manifest of one version]
type SpecVersion = {
  title: string;
  pages: { file: string; slug: string; title: string; blob: string }[];
  media: Record<string, string>; // path in the spec → blob
  changes: Record<Rev, string>; // rev → blob of its Changes snapshot
  sourceFiles: string; // blob of the files excerpts and rev-less references read
  definitions?: string; // Phase 5
  previews?: { blobs: Record<string, string> } | { screenshots: Record<string, string> }; // Phase 4
};
// [!note Rev] The same `Rev` and `Changes` types `share` already writes into a gist, from src/changes.ts.
```

Splitting the diffs by rev, instead of one JSON file as in a gist, means a reader downloads only the diffs of the page they open.

## Limits

- 25 MB per file, so a short recording fits but a long screen capture does not.
- 200 MB per version, counting built preview pages.
- 2 GB per person across all their specs.
- 30 new links an hour per person, and at most one new version every two seconds per spec, which is the pace of [live updates](04-live-link.md).
- 100 people per Restricted spec, and 200 invitations a day per person, so the invitation email cannot be used to send spam.
- Media must be an image or video type diffmap already renders. The Worker sends it with that type and `X-Content-Type-Options: nosniff`, so an "image" cannot run as a page.

Sharing checks these before uploading and says which file or limit is over.

## Cost

At a few thousand shared specs averaging 20 MB, storage is about 60 GB, under $1 a month. Reads cost $0.36 per million after the first ten million each month, and bandwidth costs nothing. The Workers paid plan is $5 a month and covers the Worker, D1, and Durable Objects at this size. Invitation email is a small per-message charge. The bill stays near $5 a month until diffmap is much larger.

## Security

diffmap.dev will host specs from anyone who signs in, and will hold sign-in cookies, so:

1. **No code from a spec runs on diffmap.dev.** The shared viewer treats HTML as hosted viewers do today ([[src/viewer/Fence.tsx#Fence]] shows a placeholder when `useViewerMode()` is not `"local"`). [Phase 4](05-previews-and-html.md) runs HTML and preview pages in frames on `<id>.diffmapusercontent.com`, a different site, so their script cannot read diffmap.dev's cookies or call its API as the reader. diffmapusercontent.com goes on the Public Suffix List, so one spec's subdomain cannot set cookies for another's.
2. **Pages on diffmapusercontent.com only open inside diffmap.dev.** The Worker answers them only when the browser is loading a frame (`Sec-Fetch-Dest: iframe`), and sends `frame-ancestors https://diffmap.dev`. An uploaded fake login page cannot be sent to people directly.
3. **Sharing publishes code, so it says what it uploads.** The dialog and the CLI list every source file the share includes. Sharing refuses files git ignores, such as `.env`, and files that look like they hold keys, naming the file and line. The person removes the file from the spec, or allows that one file after checking it.
4. **Restricted specs never reach a shared cache.** Their blobs are sent `Cache-Control: private`. Public blobs never change, so they are cached for a year.

diffmap.dev sends a `Content-Security-Policy` that allows only its own scripts, and `frame-ancestors 'none'`, so no other site can frame the share dialog or the sign-in page. Every shared page has a **Report** link; an admin can take a spec down, which deletes it as [Stop sharing](04-live-link.md#stop-sharing) does.
