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

Each flow should pass end to end against a staging Worker. Most become automated tests; the browser steps can use a test account.

**First share on a fresh machine**

1. With no `~/.config/product-doc/auth.json`, run `npx product-doc share .diffmap/specs/session-store/`. It prints a sign-in link with the code filled in, and waits.
2. Open the link, sign in with Google, and approve. The CLI prints "Signed in as …", the upload summary, the source files made public, and the link.
3. `auth.json` exists, readable only by the user. `.diffmap/specs/session-store/.productdoc.json` holds the link.

**A reader opens the link with the sharing machine off**

1. Shut down the machine that shared. In a signed-out browser, open the link. The cover renders with the document's title.
2. Open each page from the page list. `/d/<id>/<page-slug>` loads that page, and `#heading` scrolls to the section.
3. Screenshots show, and the recording plays.
4. Changes cards and the Diff panel show the same diffs as `serve`. Code excerpts and references show the right lines.
5. Preview and HTML blocks show a placeholder saying they arrive later.
6. The response has `X-Robots-Tag: noindex`.

**An agent reads the link**

1. `curl -H "Accept: text/markdown" https://productdoc.dev/d/<id>/<page-slug>` returns that page's Markdown.

**Sharing again**

1. Edit a page, then run `share` on the same folder. No sign-in prompt appears, and a new link is printed.
2. `.productdoc.json` holds the new link. The old link still shows the old version.

**Signing in with the other provider**

1. On a second machine, run `product-doc login` and sign in with GitHub, using the same verified email as the Google account. It prints the same account.
2. Run `product-doc share --stop <link from the first machine>`. It succeeds, since both machines are the same owner.

**Refusing secrets**

1. Reference `.env`, a gitignored file, in a page, and run `share`. It fails, naming `.env`. Nothing is uploaded and no link is made.
2. Reference a file containing a key such as `sk_live_…`. It fails, naming the file and line.
3. Run `share --allow src/config.ts`. It uploads.

**Refusing files over the limit**

1. Add a 41 MB recording and run `share`. It fails before uploading anything, naming the file and the 25 MB limit.

**An interrupted upload**

1. Kill `share` partway through uploading. No link is printed, and the document's ID answers 404.
2. Run `share` again. It finishes and prints a link that shows the whole document.

**Stopping sharing**

1. Run `product-doc share --stop <link>`. The link answers "The owner stopped sharing this document."
2. Another account running `--stop` on someone else's link gets "not yours", and the link keeps working.

**Signing out**

1. Run `product-doc logout`. `auth.json` is deleted, and using the old token on the API gets 401.
2. The next `share` asks to sign in again.

**Sign-in that expires**

1. Run `share` and don't approve the code. After the code expires, the CLI says so and exits without uploading.

**Reporting a document**

1. A reader clicks Report on a shared page and submits a reason. An admin sees the report and takes the document down. The link then answers that the document was removed.

**productdoc.dev after the move**

1. The productdoc.dev home page, its Markdown versions, `llms.txt`, `robots.txt`, and the sitemap answer as they did on Vercel.
2. diffmap.dev and its gist and pull request links work unchanged.

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
