/**
 * productdoc.dev on Cloudflare: the D1 database, the R2 bucket, and one Worker
 * serving the website build, sign-in, the sharing API, and shared documents.
 * `npm run cloud:dev` runs it locally; `npm run cloud:deploy` provisions and
 * deploys it. See cloud/README.md.
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

const Database = Cloudflare.D1.Database("Database", {
  migrations: "./cloud/migrations",
});

const Documents = Cloudflare.R2.Bucket("Documents");

export default Alchemy.Stack(
  "productdoc",
  {
    providers: Cloudflare.providers(),
    // Local development keeps its state on disk, so it needs no Cloudflare account.
    state: process.env.ALCHEMY_DEV ? Alchemy.localState() : Cloudflare.state(),
  },
  Effect.gen(function* () {
    const dev = yield* Alchemy.ALCHEMY_DEV;
    const authSecret = yield* Alchemy.makeRandom("BetterAuthSecret");
    // Google and GitHub need OAuth apps; local development signs in by email instead.
    const oauth: Record<string, string | Redacted.Redacted<string>> = dev
      ? { DEV_SIGN_IN: "1" }
      : {
          GOOGLE_CLIENT_ID: yield* Config.String("GOOGLE_CLIENT_ID"),
          GOOGLE_CLIENT_SECRET: yield* Config.Redacted("GOOGLE_CLIENT_SECRET"),
          GITHUB_CLIENT_ID: yield* Config.String("GITHUB_CLIENT_ID"),
          GITHUB_CLIENT_SECRET: yield* Config.Redacted("GITHUB_CLIENT_SECRET"),
        };
    const adminToken = dev
      ? Redacted.make("dev-admin-token")
      : yield* Config.Redacted("PRODUCTDOC_ADMIN_TOKEN");
    const worker = yield* Cloudflare.Worker("Productdoc", {
      main: "./src/cloud/worker.ts",
      compatibility: { flags: ["nodejs_compat"], date: "2026-11-01" },
      assets: {
        directory: "./dist",
        runWorkerFirst: true,
        htmlHandling: "none",
        notFoundHandling: "none",
      },
      domain: dev ? undefined : "productdoc.dev",
      dev: { port: 8787 },
      env: {
        DB: Database,
        BLOBS: Documents,
        BETTER_AUTH_URL: Cloudflare.Worker.URL,
        BETTER_AUTH_SECRET: authSecret,
        ADMIN_TOKEN: adminToken,
        ...oauth,
      },
    });
    return { url: worker.url };
  }),
);
