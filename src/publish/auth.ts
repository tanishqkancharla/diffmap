import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CLI_CLIENT_ID, DEFAULT_ORIGIN } from "../cloud/protocol.js";
import { ProductdocAuthError } from "../errors.js";

/** Signed-in accounts by origin, so local development never replaces the productdoc.dev sign-in. */
type AuthFile = Record<string, { token: string; email: string }>;

export function productdocOrigin() {
  return (process.env.PRODUCTDOC_ORIGIN ?? DEFAULT_ORIGIN).replace(/\/$/, "");
}

export function authFilePath() {
  const base =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(base, "product-doc", "auth.json");
}

async function readAuthFile(): Promise<AuthFile> {
  const text = await fs.readFile(authFilePath(), "utf8").catch(() => "{}");
  const parsed = (() => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return {};
    }
  })();
  return typeof parsed === "object" && parsed !== null
    ? (parsed as AuthFile)
    : {};
}

async function writeAuthFile(file: AuthFile) {
  const target = authFilePath();
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await fs.writeFile(target, `${JSON.stringify(file, undefined, 2)}\n`, {
    mode: 0o600,
  });
}

/** The token to send: PRODUCTDOC_TOKEN for cloud agents, or the saved sign-in. */
export async function savedToken(origin: string) {
  const fromEnv = process.env.PRODUCTDOC_TOKEN;
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  return (await readAuthFile())[origin]?.token;
}

export async function forgetToken(origin: string) {
  const file = await readAuthFile();
  const entry = file[origin];
  if (entry === undefined) return undefined;
  delete file[origin];
  await writeAuthFile(file);
  return entry;
}

type DeviceCode = {
  device_code: string;
  user_code: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

/**
 * Signs in by device code: prints a link, waits for the person to approve it
 * on productdoc.dev, then saves the token.
 */
export async function login(input: {
  origin: string;
  log: (line: string) => void;
}) {
  const started = await postJson(`${input.origin}/api/auth/device/code`, {
    client_id: CLI_CLIENT_ID,
  });
  if (started instanceof Error) return started;
  const code = started.body as Partial<DeviceCode>;
  if (
    typeof code.device_code !== "string" ||
    typeof code.verification_uri_complete !== "string"
  ) {
    return new ProductdocAuthError({
      reason: "productdoc.dev didn't start a sign-in",
    });
  }
  input.log(`Sign in at ${code.verification_uri_complete}`);
  const deadline = Date.now() + (code.expires_in ?? 600) * 1000;
  let interval = Math.max(code.interval ?? 5, 1) * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    const polled = await postJson(`${input.origin}/api/auth/device/token`, {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: code.device_code,
      client_id: CLI_CLIENT_ID,
    });
    if (polled instanceof Error) return polled;
    const body = polled.body as { access_token?: unknown; error?: unknown };
    if (typeof body.access_token === "string") {
      const email = await readEmail(input.origin, body.access_token);
      const file = await readAuthFile();
      file[input.origin] = { token: body.access_token, email };
      await writeAuthFile(file);
      return { email };
    }
    if (body.error === "authorization_pending") continue;
    if (body.error === "slow_down") {
      interval += 5000;
      continue;
    }
    if (body.error === "access_denied") {
      return new ProductdocAuthError({
        reason:
          "the sign-in was cancelled on productdoc.dev. Nothing was shared",
      });
    }
    if (body.error === "expired_token") break;
    return new ProductdocAuthError({
      reason: `productdoc.dev answered ${String(body.error)}`,
    });
  }
  return new ProductdocAuthError({
    reason:
      "nobody approved the sign-in within 10 minutes, so nothing was shared. Run the command again for a new link",
  });
}

async function readEmail(origin: string, token: string) {
  const response = await fetch(`${origin}/api/auth/get-session`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
  const body = (await response?.json().catch(() => undefined)) as
    | { user?: { email?: unknown } }
    | undefined;
  return typeof body?.user?.email === "string" ? body.user.email : "";
}

export async function logout(origin: string) {
  const entry = await forgetToken(origin);
  if (entry === undefined) return { signedOut: false, email: undefined };
  // Ending the session on productdoc.dev too; the local token is gone either way.
  await fetch(`${origin}/api/auth/sign-out`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${entry.token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  }).catch(() => undefined);
  return { signedOut: true, email: entry.email };
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(
    (cause: unknown) =>
      new ProductdocAuthError({
        reason: `${new URL(url).host} can't be reached`,
        cause,
      }),
  );
  if (response instanceof Error) return response;
  return {
    status: response.status,
    body: (await response.json().catch(() => ({}))) as unknown,
  };
}
