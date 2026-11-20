/**
 * Takes a shared document down:
 * `PRODUCTDOC_ADMIN_TOKEN=… npm run cloud:takedown -- <id> "<reason>"`. Set
 * `PRODUCTDOC_ORIGIN=http://localhost:8787` to try it against
 * `npm run cloud:dev`, whose token is `dev-admin-token`. The link then says the
 * document was removed, and its files stop being served. They stay in R2 for
 * the report's follow-up.
 */
import { isDocumentId } from "./protocol.ts";
import { productdocOrigin } from "../publish/auth.ts";

const [id, reason] = process.argv.slice(2);
const token = process.env.PRODUCTDOC_ADMIN_TOKEN;
if (id === undefined || !isDocumentId(id) || token === undefined) {
  console.error(
    'Usage: PRODUCTDOC_ADMIN_TOKEN=<token> npm run cloud:takedown -- <document id> ["reason"]',
  );
  process.exit(1);
}

const origin = productdocOrigin();
const response = await fetch(`${origin}/api/admin/takedown/${id}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ reason }),
});
if (!response.ok) {
  console.error(
    `Takedown failed (${String(response.status)}): ${await response.text()}`,
  );
  process.exit(1);
}
console.log(`Took down ${origin}/d/${id}`);
