/**
 * Manages the accounts that may share while sharing is internal:
 * `PRODUCTDOC_ADMIN_TOKEN=… npm run cloud:publishers -- [add|remove <email>]`.
 * With no arguments it lists them. Set `PRODUCTDOC_ORIGIN=http://localhost:8787`
 * to manage `npm run cloud:dev`'s list, whose token is `dev-admin-token`.
 */
import { productdocOrigin } from "../publish/auth.ts";

const [action, email] = process.argv.slice(2);
const token = process.env.PRODUCTDOC_ADMIN_TOKEN;
const method =
  action === undefined
    ? "GET"
    : action === "add"
      ? "PUT"
      : action === "remove"
        ? "DELETE"
        : undefined;
if (
  token === undefined ||
  method === undefined ||
  (method !== "GET" && email?.includes("@") !== true)
) {
  console.error(
    "Usage: PRODUCTDOC_ADMIN_TOKEN=<token> npm run cloud:publishers -- [add|remove <email>]",
  );
  process.exit(1);
}

const path = method === "GET" ? "" : `/${encodeURIComponent(email ?? "")}`;
const url = `${productdocOrigin()}/api/admin/publishers${path}`;
const response = await fetch(url, {
  method,
  headers: { Authorization: `Bearer ${token}` },
}).catch(() => {
  console.error(`Couldn't reach ${url}.`);
  process.exit(1);
});
if (!response.ok) {
  console.error(
    `Failed (${String(response.status)}): ${await response.text()}`,
  );
  process.exit(1);
}
const body = (await response.json()) as { publishers?: string[] };
if (body.publishers !== undefined) console.log(body.publishers.join("\n"));
else
  console.log(
    `${action === "add" ? "Added" : "Removed"} ${email?.toLowerCase() ?? ""}`,
  );
