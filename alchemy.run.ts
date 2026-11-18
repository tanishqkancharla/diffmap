/**
 * productdoc.dev on Cloudflare: the productdoc.dev zone, the D1 database, the
 * R2 bucket, and one Worker serving the website build, sign-in, the sharing
 * API, and shared documents. `npm run cloud:dev` runs it locally;
 * `npm run cloud:deploy` provisions and deploys it. See cloud/README.md.
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

const DOMAIN = "productdoc.dev";

const Database = Cloudflare.D1.Database("Database", {
  migrations: "./cloud/migrations",
});

const Documents = Cloudflare.R2.Bucket("Documents");

/** An OAuth app's credentials as Worker env, or nothing until both are set. */
const oauthApp = (prefix: "GOOGLE" | "GITHUB") =>
  Effect.gen(function* () {
    const id = yield* Config.option(Config.String(`${prefix}_CLIENT_ID`));
    const secret = yield* Config.option(
      Config.Redacted(`${prefix}_CLIENT_SECRET`),
    );
    if (Option.isNone(id) || Option.isNone(secret)) return {};
    return {
      [`${prefix}_CLIENT_ID`]: id.value,
      [`${prefix}_CLIENT_SECRET`]: secret.value,
    };
  });

export default Alchemy.Stack(
  "productdoc",
  {
    providers: Cloudflare.providers(),
    // Local development keeps its state on disk, so it needs no Cloudflare account.
    state: process.env.ALCHEMY_DEV ? Alchemy.localState() : Cloudflare.state(),
  },
  Effect.gen(function* () {
    const dev = yield* Alchemy.ALCHEMY_DEV;
    // The domain can only be attached once its nameservers point at Cloudflare.
    const live =
      !dev &&
      (yield* Config.Boolean("PRODUCTDOC_LIVE").pipe(
        Config.withDefault(false),
      ));

    const zone = dev
      ? undefined
      : yield* Cloudflare.Zone.Zone("Zone", { name: DOMAIN });

    if (live && zone !== undefined) {
      const abuseInbox = yield* Config.String("PRODUCTDOC_ABUSE_FORWARD_TO");
      const destination = yield* Cloudflare.Email.Address("AbuseInbox", {
        email: abuseInbox,
      });
      yield* Cloudflare.Email.Routing("EmailRouting", { zone });
      yield* Cloudflare.Email.Rule("Abuse", {
        zone,
        name: `abuse@${DOMAIN}`,
        matchers: [{ type: "literal", field: "to", value: `abuse@${DOMAIN}` }],
        actions: [{ type: "forward", value: [destination.email] }],
      });
    }

    const authSecret = yield* Alchemy.makeRandom("BetterAuthSecret");
    // Local development signs in by email in place of Google and GitHub.
    const signIn: Record<string, string | Redacted.Redacted<string>> = dev
      ? { DEV_SIGN_IN: "1" }
      : { ...(yield* oauthApp("GOOGLE")), ...(yield* oauthApp("GITHUB")) };
    const adminToken = dev
      ? Redacted.make("dev-admin-token")
      : yield* Config.Redacted("PRODUCTDOC_ADMIN_TOKEN");

    const worker = yield* Cloudflare.Worker("Productdoc", {
      main: "./src/cloud/worker.ts",
      compatibility: { flags: ["nodejs_compat"], date: "2026-11-01" },
      assets: {
        directory: "./dist",
        // Hashed bundles skip the Worker: asset requests are free and uncounted.
        runWorkerFirst: ["/*", "!/assets/*"],
        htmlHandling: "none",
        notFoundHandling: "none",
      },
      domain: live ? DOMAIN : undefined,
      observability: { enabled: true },
      dev: { port: 8787 },
      env: {
        DB: Database,
        BLOBS: Documents,
        BETTER_AUTH_URL: Cloudflare.Worker.URL,
        BETTER_AUTH_SECRET: authSecret,
        ADMIN_TOKEN: adminToken,
        ...signIn,
      },
    });
    return {
      url: worker.url,
      ...(zone === undefined ? {} : { nameServers: zone.nameServers }),
    };
  }),
);
