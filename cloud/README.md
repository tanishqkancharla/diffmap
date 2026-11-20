# share.productdoc.dev Worker

One Cloudflare Worker serves sign-in (`/api/auth`, `/device`), the sharing API (`/api/documents`), and shared documents (`/d/<id>`) at share.productdoc.dev. Any other path redirects to productdoc.dev, which stays on Vercel. Code is in `src/cloud/`; the browser pages are `gist/shared.html` and `gist/device.html` in the website build.

[Alchemy](https://alchemy.run/) provisions it from `alchemy.run.ts` at the repository root: the D1 database (with `migrations/` applied), the R2 bucket for document files, the Worker, and its share.productdoc.dev custom domain. It also manages productdoc.dev's Cloudflare zone and the two DNS records that keep productdoc.dev and its other subdomains on Vercel; the share.productdoc.dev record takes precedence over their wildcard.

## Internal for now

Sharing to productdoc.dev isn't public yet. The CLI's `share` publishes a gist unless `PRODUCTDOC_ORIGIN` is set, which also adds `login` and `logout`; the public docs don't mention it. The server lets only the verified emails in D1's `publisher` table create documents, while anyone with a link can read it. The first migration adds tanishqkancharla3@gmail.com; manage the rest with:

```sh
PRODUCTDOC_ADMIN_TOKEN=… npm run cloud:publishers                    # list
PRODUCTDOC_ADMIN_TOKEN=… npm run cloud:publishers -- add <email>
PRODUCTDOC_ADMIN_TOKEN=… npm run cloud:publishers -- remove <email>
```

Changes apply at once, with no deploy. To share as an allowed account:

```sh
PRODUCTDOC_ORIGIN=https://share.productdoc.dev npx product-doc share <spec>
```

## Run it locally

```sh
npm run cloud:dev
```

This builds the website and runs the stack with `alchemy dev`: the Worker, D1, and R2 run on this machine at http://localhost:8787, with no Cloudflare account. State stays in `.alchemy/`. Sign-in skips Google and GitHub: the device page asks for any email. Only allowed emails can share here too: sign in as tanishqkancharla3@gmail.com, or add another with `cloud:publishers` (`PRODUCTDOC_ORIGIN=http://localhost:8787`, token `dev-admin-token`). Share against it with:

```sh
PRODUCTDOC_ORIGIN=http://localhost:8787 npm run cli -- share <spec>
```

## Deploy

`npm run cloud:deploy` builds the website and deploys the `prod` stage. It reads its settings from `.env` at the repository root (gitignored) or from the environment; `cloud/.env.example` lists them. Each deploy creates or updates what's missing and applies new migrations. Alchemy keeps its state in the Cloudflare account, so deploys from any machine see the same resources, and Better Auth's secret stays in that state.

1. Sign in to the Cloudflare account that owns productdoc.dev: `npx alchemy profile edit`. Choose OAuth, then Custom Scopes: the Developer Platform group, plus `memberships.read`, `user-details.read`, `account-settings.read`, `zone.read`, `zone.write`, `dns.read`, `dns.write`, `zone-settings.read`, `zone-settings.write`, `ssl-and-certificates.write`, and `account-ssl-and-certificates.write`. Without `memberships.read` sign-in finds no accounts. To deploy from somewhere without a browser, run `npx alchemy provider cloudflare token` and set the `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` it prints there.
2. Set `PRODUCTDOC_ADMIN_TOKEN` (`openssl rand -hex 32`).
3. Create a GitHub OAuth app and a Google OAuth client. Their callbacks are `https://share.productdoc.dev/api/auth/callback/github` and `https://share.productdoc.dev/api/auth/callback/google`. Set their `GITHUB_*` and `GOOGLE_*` values; each provider turns on once both of its values are set.
4. `npm run cloud:deploy`.

## Take a document down

```sh
PRODUCTDOC_ADMIN_TOKEN=… npm run cloud:takedown -- <id> "reason"
```

The link then says the document was removed. Its files stay in R2 but are no longer served. Against `npm run cloud:dev`, set `PRODUCTDOC_ORIGIN=http://localhost:8787` and use the token `dev-admin-token`.

## Change the auth tables

After changing Better Auth's plugins, print the new schema with `node --import tsx src/cloud/authSchema.ts` and add the difference as the next file in `migrations/`.
