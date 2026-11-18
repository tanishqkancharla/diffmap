# productdoc.dev Worker

One Cloudflare Worker serves the website, sign-in (`/api/auth`, `/device`), the sharing API (`/api/documents`), and shared documents (`/d/<id>`). Code is in `src/cloud/`; the browser pages are `gist/shared.html` and `gist/device.html` in the website build.

[Alchemy](https://alchemy.run/) provisions it from `alchemy.run.ts` at the repository root: the productdoc.dev zone, the D1 database (with `migrations/` applied), the R2 bucket for document files, the Worker with the website build as its assets, the custom domain, and abuse@ forwarding.

## Internal for now

Sharing to productdoc.dev isn't public yet. The CLI's `share` publishes a gist unless `PRODUCTDOC_ORIGIN` is set, which also adds `login` and `logout`; the public docs don't mention it. The server lets only the verified emails in `PRODUCTDOC_PUBLISHERS` create documents, while anyone with a link can read it. To share as an allowed account:

```sh
PRODUCTDOC_ORIGIN=https://productdoc.dev npx product-doc share <spec>
```

## Run it locally

```sh
npm run cloud:dev
```

This builds the website and runs the stack with `alchemy dev`: the Worker, D1, and R2 run on this machine at http://localhost:8787, with no Cloudflare account. State stays in `.alchemy/`. Sign-in skips Google and GitHub: the device page asks for any email. Every dev account can share unless `PRODUCTDOC_PUBLISHERS` is set. Share against it with:

```sh
PRODUCTDOC_ORIGIN=http://localhost:8787 npm run cli -- share <spec>
```

## Deploy

`npm run cloud:deploy` builds the website and deploys the `prod` stage. It reads its settings from `.env` at the repository root (gitignored) or from the environment; `cloud/.env.example` lists them. Each deploy creates or updates what's missing and applies new migrations. The first one also sets up Alchemy's state store in the Cloudflare account, so later deploys from any machine see the same resources, and generates Better Auth's secret, which stays in that state.

productdoc.dev was bought through Vercel and its DNS is on Vercel, with only Vercel's own records. Going live takes two deploys, because Cloudflare serves the domain only after its nameservers point there.

**1. Deploy to workers.dev**

1. Sign in to the Cloudflare account that will own productdoc.dev: `npx alchemy profile edit` on your machine. Choose OAuth, then Custom Scopes: the Developer Platform group, plus `memberships.read`, `user-details.read`, `account-settings.read`, `zone.read`, `zone.write`, `dns.read`, `dns.write`, `zone-settings.read`, `zone-settings.write`, `ssl-and-certificates.write`, `account-ssl-and-certificates.write`, and the four `email-routing-address` and `email-routing-rule` read and write scopes. Basic Scopes can't create the zone, and without `memberships.read` sign-in finds no accounts. To deploy from somewhere without a browser, such as a cloud agent, run `npx alchemy provider cloudflare token` and set the `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` it prints there.
2. Set `PRODUCTDOC_ADMIN_TOKEN` (`openssl rand -hex 32`) and `PRODUCTDOC_PUBLISHERS`, the comma-separated emails of the accounts that may share.
3. `npm run cloud:deploy`. It prints the Worker's `workers.dev` URL, where the website and shared links already work, and the two `nameServers` Cloudflare assigned to the new productdoc.dev zone.

**2. Move the domain and go live**

1. In Vercel, under Domains → productdoc.dev → Nameservers, replace Vercel's with the two from step 1. Until Cloudflare sees the change, productdoc.dev keeps serving from Vercel. diffmap.dev stays on Vercel.
2. Create a Google OAuth client and a GitHub OAuth app. Their callbacks are `https://productdoc.dev/api/auth/callback/google` and `https://productdoc.dev/api/auth/callback/github`. Set their `GOOGLE_*` and `GITHUB_*` values.
3. Once Cloudflare shows the zone as active, set `PRODUCTDOC_LIVE=1` and `PRODUCTDOC_ABUSE_FORWARD_TO` to the inbox that reads abuse@productdoc.dev, and deploy again. That attaches productdoc.dev to the Worker and forwards abuse@ there. Cloudflare emails that inbox a link to confirm it.

## Take a document down

```sh
PRODUCTDOC_ADMIN_TOKEN=… npm run cloud:takedown -- <id> "reason"
```

The link then says the document was removed. Its files stay in R2 for follow-up but are no longer served. Against `npm run cloud:dev`, set `PRODUCTDOC_ORIGIN=http://localhost:8787` and use the token `dev-admin-token`.

## Change the auth tables

After changing Better Auth's plugins, print the new schema with `node --import tsx src/cloud/authSchema.ts` and add the difference as the next file in `migrations/`.
