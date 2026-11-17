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
- Sharing refuses gitignored files and anything that looks like a key, naming the file. `--allow <file>` overrides one file after checking it.
- `product-doc share --stop` deletes the link.
- Public documents show a bar above the viewer: who shared it, and a "Share your own" link to productdoc.dev. Search engines may index them.
- **Errors you can fix offer an agent prompt.** A screen that stops you, such as an expired sign-in, shows a prompt to copy to your agent, like "Sign me in to productdoc again and finish sharing."

```callstack [Sharing]
link = shareDocument(dir)
├── bundle = pages + media + diff snapshots + source files
├── check limits, gitignored files, and keys
├── id = POST /api/documents
├── PUT /api/documents/{id}/blobs/{sha256} for each missing blob
├── POST /api/documents/{id}/versions {manifest}
└── write dir/.productdoc.json {link}
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

- [ ] Move productdoc.dev to a Cloudflare Worker serving the website
- [ ] R2 bucket, and D1 `document` and `document_version` tables
- [ ] Better Auth: Google, GitHub, account linking, device authorization, bearer tokens
- [ ] `product-doc login` and `logout`
- [ ] Upload API: create, upload blobs, commit a version
- [ ] `product-doc share`, with the limit and secret checks, writing `.productdoc.json`
- [ ] `/d/<id>` in the hosted viewer, with Markdown for agents and the public bar
- [ ] `share --stop`, an admin takedown command, and abuse@productdoc.dev
- [ ] An agent prompt on each error screen a person can fix
- [ ] Update the guide's sharing section

```changes

```
