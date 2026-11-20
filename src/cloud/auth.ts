import { betterAuth, type BetterAuthOptions } from "better-auth";
import { bearer, deviceAuthorization } from "better-auth/plugins";
import { CLI_CLIENT_ID } from "./protocol.ts";
import type { Env } from "./env.ts";

/** Letters and digits that can't be misread for each other, such as 0 and O. */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** A code such as 4F2A-91BC, shown in the terminal and on productdoc.dev/device. */
export function generateUserCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map(
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
  );
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export function authOptions(env: Env) {
  const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }
  return {
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    database: env.DB,
    socialProviders,
    // Google and GitHub with the same verified email are one account.
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
    },
    emailAndPassword: { enabled: env.DEV_SIGN_IN === "1" },
    // A terminal signs in once and keeps sharing for two months.
    session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
    plugins: [
      deviceAuthorization({
        verificationUri: "/device",
        expiresIn: "10m",
        interval: "3s",
        generateUserCode,
        validateClient: (clientId) => clientId === CLI_CLIENT_ID,
      }),
      bearer(),
    ],
  } satisfies BetterAuthOptions;
}

export function createAuth(env: Env) {
  return betterAuth(authOptions(env));
}

export type Auth = ReturnType<typeof createAuth>;
