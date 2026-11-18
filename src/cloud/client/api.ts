import * as errore from "errore";
import type { Account } from "../../viewer/share/ShareForm.tsx";

export class RequestError extends errore.createTaggedError({
  name: "RequestError",
  message: "$message",
}) {}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
  }).catch(
    (cause: unknown) =>
      new RequestError({ message: "productdoc.dev can't be reached", cause }),
  );
  if (response instanceof Error) return response;
  const body = (await response.json().catch(() => undefined)) as unknown;
  if (!response.ok) {
    const fields = (
      typeof body === "object" && body !== null ? body : {}
    ) as Record<string, unknown>;
    const message =
      [fields.error_description, fields.message, fields.error].find(
        (value): value is string => typeof value === "string",
      ) ?? `productdoc.dev answered ${String(response.status)}`;
    return new RequestError({ message });
  }
  return body;
}

export function getJson(path: string) {
  return request(path);
}

export function postJson(path: string, body: unknown) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function readSession(): Promise<Account | undefined> {
  const session = await getJson("/api/auth/get-session");
  if (
    session instanceof Error ||
    typeof session !== "object" ||
    session === null
  )
    return undefined;
  const user = (session as { user?: { name?: unknown; email?: unknown } }).user;
  if (typeof user?.email !== "string") return undefined;
  return {
    email: user.email,
    name: typeof user.name === "string" ? user.name : user.email,
  };
}

export async function readConfig() {
  const config = await getJson("/api/config");
  return {
    devSignIn:
      !(config instanceof Error) &&
      (config as { devSignIn?: unknown }).devSignIn === true,
  };
}
