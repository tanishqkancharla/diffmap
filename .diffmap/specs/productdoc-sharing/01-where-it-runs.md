# Where it runs

The platform under every phase.

## Cloudflare

| Need                                   | Cloudflare                       |
| -------------------------------------- | -------------------------------- |
| Files: pages, media, diffs, previews   | R2: no bandwidth charges         |
| Website, viewer, API, sign-in          | One Worker on productdoc.dev     |
| Accounts, documents, versions, access  | D1                               |
| Readers seeing new versions live       | A Durable Object per document    |
| Invitations                            | Email Sending                    |
| Code from documents, on its own domain | `<id>.productdocusercontent.com` |

- productdoc.dev's DNS moves to Cloudflare. The Worker serves the website pages the build already writes ([[src/website/README.md]]).
- [Alchemy](https://alchemy.run/) provisions it all from one TypeScript file, `alchemy.run.ts`, and runs the same stack locally without a Cloudflare account.
- diffmap.dev stays on Vercel, unchanged.
- About $5 a month at a few thousand documents.

## Sign-in

[Better Auth](https://www.better-auth.com) on D1:

- Google and GitHub sign-in, linked into one account by verified email.
- Device authorization for the CLI and the local viewer, since a VM can't receive a redirect. The token is saved to `~/.config/product-doc/auth.json`.
- `PRODUCTDOC_TOKEN` for cloud agents, so a fresh VM can publish without someone approving a sign-in.

## Storage

```text
R2   documents/<id>/blobs/<sha256>      page, media, diff snapshot, or preview file
     documents/<id>/versions/<n>.json   manifest: which blobs version n shows

D1   Better Auth tables, plus
     user_email       (user_id, email)
     document         (id, owner_id, title, access, latest_version, deleted_at)
     document_member  (document_id, email)
     document_version (document_id, n, manifest_hash, published_by, created_at)
```

- Files are stored by hash, so publishing uploads only what changed.
- The bucket is private. Every read goes through the Worker's access check.

## Limits

- 25 MB per file, 200 MB per version, and 2 GB per person.
- At most one version every two seconds per document.
- 100 people per Restricted document, and 200 invitations a day.

## Security

- No document code runs on productdoc.dev. Previews and HTML run in frames on productdocusercontent.com ([Phase 5](06-previews-and-html.md)).
- Publishing lists the source files it makes public, and refuses gitignored files and anything that looks like a key.
- Restricted blobs are `Cache-Control: private`.
- Admins can take a document down, from reports to abuse@productdoc.dev. A Report button waits until abuse shows up.
