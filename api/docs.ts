import type { IncomingMessage, ServerResponse } from "node:http";
import { respondPage } from "../src/website/respond.ts";

/** Vercel adapter; the local preview exercises the same response implementation. */
export default async function docs(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "https://productdoc.dev");
  await respondPage(req, res, url.searchParams.get("path") ?? "/");
}
