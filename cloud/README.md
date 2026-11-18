# productdoc.dev Worker

One Cloudflare Worker serves the website, sign-in (`/api/auth`, `/device`), the sharing API (`/api/documents`), and shared documents (`/d/<id>`). Code is in `src/cloud/`; the browser pages are `gist/shared.html` and `gist/device.html` in the website build.

## Run it locally

```sh
npm run cloud:dev
```

This builds the website, applies `migrations/` to a local D1, and serves on http://localhost:8787 with local D1 and R2. Sign-in skips Google and GitHub: the device page asks for any email. Share against it with:

```sh
PRODUCTDOC_ORIGIN=http://localhost:8787 npm run cli -- share <spec>
```

## Deploy

Once, in the Cloudflare account that will own productdoc.dev:

1. `npx wrangler d1 create productdoc`, and put its id in `wrangler.jsonc`.
2. `npx wrangler r2 bucket create productdoc-documents`.
3. Create a Google OAuth client and a GitHub OAuth app, each with the callback `https://productdoc.dev/api/auth/callback/<google|github>`.
4. Set the secrets with `npx wrangler secret put <NAME> --config cloud/wrangler.jsonc`: `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.
5. Move productdoc.dev's DNS to Cloudflare and add the domain as the Worker's custom domain. diffmap.dev stays on Vercel.
6. Route abuse@productdoc.dev to someone who reads it.

Then `npm run cloud:deploy` builds, migrates the remote D1, and deploys.

## Take a document down

```sh
npm run cloud:takedown -- <id> "reason"
```

The link then says the document was removed. Its files stay in R2 for follow-up but are no longer served.

## Change the auth tables

After changing Better Auth's plugins, print the new schema with `node --import tsx src/cloud/authSchema.ts` and add the difference as the next file in `migrations/`.
