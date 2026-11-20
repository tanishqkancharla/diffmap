# Share productdocs to share.productdoc.dev

You sign in with GitHub or Google, run `share`, and get a link at `share.productdoc.dev/d/<id>`. Anyone with the link can read it. Only your account can share; the server refuses everyone else.

Cursor already built most of this in [PR #59](https://github.com/tanishqkancharla/diffmap/pull/59). This plan narrows it to that one job.

## Decided

- **Readers:** anyone with the link, like an unlisted gist. No sign-in to read.
- **Publishers:** only you. The server checks the signed-in account's verified email against a `publisher` table that holds only `tanishqkancharla3@gmail.com`. Other accounts get a 403.
- **Sign-in:** GitHub or Google, linked into one account by verified email.
- **Address:** `share.productdoc.dev`. productdoc.dev stays on Vercel, unchanged.

```ts
// What the server does for every upload (already on the branch)
const user = await getSession(request); // GitHub or Google
if (!user) return problem(401, "Sign in first: run product-doc login.");
if (!user.emailVerified || !publishers.has(user.email)) return problem(403);
return saveDocument(user, upload); // link: share.productdoc.dev/d/<id>
```

## What changes from Cursor's plan

```mermaid diff [productdoc.dev stays where it is]
 flowchart LR
     V[Visitors to productdoc.dev] --> Vercel[Vercel website]
-    V -.->|after cutover| W[Worker]
+    R[Readers of share.productdoc.dev] --> W[Worker]
     CLI[product-doc share] --> W
     W --> S[(D1 + R2)]
```

- **No domain cutover.** The Worker gets only `share.productdoc.dev`. It stops serving a copy of the website, so it can't fall behind main.
- **No abuse inbox.** Only you publish, so there's nothing to report. The admin takedown command stays, since it's built.
- **No local Cloudflare test stack.** Tests run against the real deployment.

## Phases

1. [Point the Worker at share.productdoc.dev](01-share-subdomain.md)
2. [Turn on sign-in and prove it](02-sign-in-and-proof.md)
3. [Keep one link when you share again](03-keep-one-link.md) (declined for now)

## Check this

- **The CLI.** The released `share` keeps making gists. You opt in to the cloud with `PRODUCTDOC_ORIGIN=https://share.productdoc.dev`. I'd keep it this way, so other people's `share` doesn't start failing with a 403.
- **Cost:** with only you publishing, storage stays far below R2's 10 GB free tier. Reads count against the Workers free plan's 100,000 requests a day.
