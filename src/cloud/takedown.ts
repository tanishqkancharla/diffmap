/**
 * Takes a shared document down after a report to abuse@productdoc.dev:
 * `npm run cloud:takedown -- <id> "<reason>"`, or with `--local` against
 * `npm run cloud:dev`. The link then says the document was removed, and its
 * files stop being served. They stay in R2 for the report's follow-up.
 */
import { execFileSync } from "node:child_process";
import { isDocumentId } from "./protocol.ts";

const args = process.argv.slice(2);
const local = args.includes("--local");
const [id, reason = "Reported to abuse@productdoc.dev"] = args.filter(
  (arg) => arg !== "--local",
);
if (id === undefined || !isDocumentId(id)) {
  console.error(
    'Usage: npm run cloud:takedown -- <document id> ["reason"] [--local]',
  );
  process.exit(1);
}

const sql = `update "document" set "removed_at" = ${String(Date.now())}, "removed_reason" = '${reason.replaceAll("'", "''")}' where "id" = '${id}'`;
execFileSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "productdoc",
    local ? "--local" : "--remote",
    "--config",
    "cloud/wrangler.jsonc",
    ...(local ? ["--env", "dev"] : []),
    "--command",
    sql,
  ],
  { stdio: "inherit" },
);
console.log(`Took down https://productdoc.dev/d/${id}`);
