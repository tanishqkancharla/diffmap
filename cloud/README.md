# productdoc.dev Worker

One Cloudflare Worker serves the website, sign-in (`/api/auth`, `/device`), the sharing API (`/api/documents`), and shared documents (`/d/<id>`). Code is in `src/cloud/`; the browser pages are `gist/shared.html` and `gist/device.html` in the website build.

[Alchemy](https://alchemy.run/) provisions it from `alchemy.run.ts` at the repository root: the D1 database (with `migrations/` applied), the R2 bucket for document files, the Worker with the website build as its assets, and the productdoc.dev custom domain.

## Run it locally

```sh
npm run cloud:dev
```

This builds the website and runs the stack with `alchemy dev`: the Worker, D1, and R2 run on this machine at http://localhost:8787, with no Cloudflare account. State stays in `.alchemy/`. Sign-in skips Google and GitHub: the device page asks for any email. Share against it with:

```sh
PRODUCTDOC_ORIGIN=http://localhost:8787 npm run cli -- share <spec>
```

## Deploy

Once, in the Cloudflare account that will own productdoc.dev:

1. Move productdoc.dev's DNS to Cloudflare. diffmap.dev stays on Vercel.
2. Run `npx alchemy profile edit` and sign in to that account.
3. Create a Google OAuth client and a GitHub OAuth app, each with the callback `https://productdoc.dev/api/auth/callback/<google|github>`.
4. Put their credentials, and a token for takedowns (`openssl rand -hex 32`), in `.env` at the repository root. It is gitignored.

   ```sh
   GOOGLE_CLIENT_ID=…
   GOOGLE_CLIENT_SECRET=…
   GITHUB_CLIENT_ID=…
   GITHUB_CLIENT_SECRET=…
   PRODUCTDOC_ADMIN_TOKEN=…
   ```

5. Route abuse@productdoc.dev to someone who reads it.

Then `npm run cloud:deploy` builds the website and deploys the `prod` stage: it creates or updates the database, bucket, Worker, and domain, and applies new migrations. The first deploy also sets up Alchemy's state store in the account, so later deploys from any machine see the same resources. Better Auth's secret is generated on that first deploy and kept in the state.

## Take a document down

```sh
PRODUCTDOC_ADMIN_TOKEN=… npm run cloud:takedown -- <id> "reason"
```

The link then says the document was removed. Its files stay in R2 for follow-up but are no longer served. Against `npm run cloud:dev`, set `PRODUCTDOC_ORIGIN=http://localhost:8787` and use the token `dev-admin-token`.

## Change the auth tables

After changing Better Auth's plugins, print the new schema with `node --import tsx src/cloud/authSchema.ts` and add the difference as the next file in `migrations/`.
