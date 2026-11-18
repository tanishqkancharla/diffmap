# Phase 1: Publish from the CLI

The first version. An agent runs one command and gets a public link that shows the whole document with the sharing machine turned off.

**Today:** `product-doc share` ([[src/share.ts#shareMarkdownFile]]) makes a gist through `gh`, refuses screenshots and recordings, and the reader hits GitHub's limit of 60 loads an hour.

**Proposed**

```text
$ npx product-doc share .diffmap/specs/session-store/
Sign in at https://productdoc.dev/device?user_code=4F2A-91BC
Uploading 7 pages, 4 screenshots, 1 recording, and 3 commits of diffs (6.2 MB)
Now public: src/store.ts, src/session.ts, src/store.test.ts
https://productdoc.dev/d/k3v9q2xa7m
```

- First run: sign in by device code with Google or GitHub.
- The upload includes pages, media, diff snapshots ([[src/git.ts#readDocumentChanges]]), and source files.
- Sharing writes `.productdoc.json` (the link) into the document folder. Sharing again replaces the link until [Phase 3](04-keep-the-link-current.md).
- `/d/<id>` renders with the hosted viewer ([[src/host/HostApp.tsx#HostApp]]). Previews and HTML show placeholders until [Phase 5](06-previews-and-html.md).
- Sharing refuses gitignored files and anything that looks like a key, naming the file. `--allow <file>` overrides one file after checking it.
- `product-doc share --stop` deletes the link.
- Public documents show a bar above the viewer: who shared it, and a "Share your own" link to productdoc.dev. Search engines may index them.
- **Errors you can fix offer an agent prompt.** A screen that stops you, such as an expired sign-in, shows a prompt to copy to your agent, like "Sign me in to productdoc again and finish sharing."

```callstack [Sharing]
link = shareDocument(dir) [[ef38f7f:src/publish/share.ts#L28-L90]]
├── bundle = pages + media + diff snapshots + source files
├── check limits, gitignored files, and keys [[ef38f7f:src/publish/secrets.ts#L37-L45]]
├── sign in by device code if there's no token [[ef38f7f:src/publish/auth.ts#L70-L126]]
├── id = POST /api/documents [[ef38f7f:src/cloud/documents.ts#L58-L72]]
├── missing = POST /api/documents/{id}/missing {hashes}
├── PUT /api/documents/{id}/blobs/{sha256} for each missing blob [[ef38f7f:src/cloud/documents.ts#L127-L150]]
├── POST /api/documents/{id}/versions {manifest} [[ef38f7f:src/cloud/documents.ts#L175-L241]]
└── write dir/.productdoc.json {id, link}
```

## Expected flows

**Sharing for the first time**

1. You ask your agent to share the document.
2. The agent gives you a sign-in link. You open it, sign in with Google, and approve.
3. The agent gives you the document's link, and tells you which source files are now public.

```flow [Allowing the terminal to share as you]
share-device-sign-in--sign-in
  share-device-sign-in--confirm: Click "Continue with Google" and pick your account
    share-device-sign-in--approved: Check the code matches, and click "Allow"
    share-device-sign-in--denied: Click "Cancel"
```

**Someone reads it**

1. You send the link to a teammate and shut your laptop.
2. They open it without signing in, and see the cover under a bar saying who shared it publicly, with a link to productdoc.dev.
3. They click through the pages, look at the screenshots, play the recording, and read the diffs and code, the same as you see locally.
4. Live UI blocks say they're coming later.
5. They send a link to one section, and it opens at that section.

```preview [What a reader sees around the document]
share-shared-page--public
```

**Their agent reads it**

1. Your teammate gives the link to their agent.
2. The agent reads the document's text and can answer questions about it.

**Sharing again**

1. You ask your agent to fix a page and share again. It doesn't ask you to sign in.
2. You get a new link with the fix. The old link still shows the old version.

**Sharing from another machine**

1. On a different machine, you sign in with GitHub instead of Google.
2. You're the same account: you can stop sharing a link you made on the first machine.

**Something private would be shared**

1. The document shows a file that holds a password or key.
2. Sharing stops before anything is uploaded, and names the file.
3. You remove it from the document, or confirm that file is fine, and share again.

**A file is too big**

1. The document has a long screen recording.
2. Sharing stops before anything is uploaded, and the agent tells you which file is too big and the limit.
3. You ask the agent to trim it, and it shares.

**The connection drops while sharing**

1. Your Wi-Fi cuts out halfway through.
2. You get no link, and nothing half-uploaded is visible to anyone.
3. Sharing again works.

**Stopping sharing**

1. You ask your agent to stop sharing the document.
2. Anyone opening the link sees that you stopped sharing it.
3. Nobody else can stop sharing your documents.

```preview [Opening a link that's no longer shared]
share-shared-page--stopped
share-shared-page--removed
```

**Signing out**

1. You sign out.
2. The next time you share, you're asked to sign in again.

**You don't finish signing in**

1. You ignore the sign-in link.
2. After a while, sharing gives up and tells you, without uploading anything.
3. If you open the link later, it says the code expired, and offers a prompt to copy to your agent: "Sign me in to productdoc again and finish sharing."

```preview [Opening an expired sign-in link]
share-device-sign-in--expired
```

**A document gets taken down**

1. Someone emails abuse@productdoc.dev about a shared document.
2. An admin takes it down. The link says the document was removed.

**Everything else still works**

1. The productdoc.dev website looks and works as before.
2. diffmap.dev and links already shared there work as before.

## Todos

The code runs end to end against `npm run cloud:dev` ([[fdbadfd:cloud/README.md]]), and it's deployed to workers.dev. Sharing is internal for now: the CLI offers it only when `PRODUCTDOC_ORIGIN` is set, and the Worker lets only the accounts in `PRODUCTDOC_PUBLISHERS` publish [[fdbadfd:src/cloud/documents.ts]]. Going live needs DNS and the Google and GitHub apps.

- [x] Provision D1, R2, the Worker, and its domain with Alchemy
- [x] Deploy to workers.dev, publishing open only to allowlisted accounts
- [ ] Move productdoc.dev's DNS to Cloudflare and add the OAuth apps
- [x] A Cloudflare Worker serving the website
- [x] R2 bucket, and D1 `document` and `document_version` tables
- [x] Better Auth: Google, GitHub, account linking, device authorization, bearer tokens
- [x] `product-doc login` and `logout`
- [x] Upload API: create, upload blobs, commit a version
- [x] `product-doc share`, with the limit and secret checks, writing `.productdoc.json`
- [x] `/d/<id>` in the hosted viewer, with Markdown for agents and the public bar
- [x] `share --stop`, an admin takedown command, and abuse@productdoc.dev
- [x] An agent prompt on each error screen a person can fix
- [ ] Document sharing in the README and guide once it's open to everyone

```changes
1029efd..fdbadfd
src/cli.ts
src/publish/share.ts
src/publish/auth.ts
src/publish/secrets.ts
src/cloud/protocol.ts
src/cloud/worker.ts
src/cloud/auth.ts
src/cloud/documents.ts
src/cloud/reader.ts
src/cloud/site.ts
src/cloud/client/SharedApp.tsx
src/cloud/client/DeviceApp.tsx
src/viewer/share/DevicePage.tsx
cloud/migrations/0002_documents.sql
alchemy.run.ts
cloud/README.md
src/publish/share.test.ts
src/share.ts
ignore:
cloud/migrations/0001_auth.sql
gist/device.html
gist/shared.html
.gitignore
guide.md
guide/ui.md
package.json
package-lock.json
README.md
src/cli.test.ts
src/cloud/authSchema.ts
src/cloud/client/api.ts
src/cloud/client/deviceMain.tsx
src/cloud/client/sharedMain.tsx
src/cloud/env.ts
src/cloud/takedown.ts
src/errors.ts
src/website/negotiate.ts
src/website/respond.ts
vite.gist.config.ts
tsconfig.json
.diffmap/specs/productdoc-sharing/02-publish-from-the-cli.md
```
