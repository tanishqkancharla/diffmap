import { parseDiffFromFile } from "@pierre/diffs";
import type { ChangedFile, Changes } from "../changes.ts";
import dbBefore from "../../fixtures/session-store-pr/before/src/db.ts?raw";
import dbAfter from "../../fixtures/session-store-pr/after/src/db.ts?raw";
import memoryBefore from "../../fixtures/session-store-pr/before/src/sessions/memory.ts?raw";
import storeAfter from "../../fixtures/session-store-pr/after/src/sessions/store.ts?raw";
import migrationAfter from "../../fixtures/session-store-pr/after/migrations/0004_sessions.sql?raw";
import loginBefore from "../../fixtures/session-store-pr/before/src/routes/login.ts?raw";
import loginAfter from "../../fixtures/session-store-pr/after/src/routes/login.ts?raw";
import requireSessionBefore from "../../fixtures/session-store-pr/before/src/middleware/requireSession.ts?raw";
import requireSessionAfter from "../../fixtures/session-store-pr/after/src/middleware/requireSession.ts?raw";

/**
 * The homepage's examples explain one made-up pull request. Its commit is not
 * on GitHub, so the homepage serves it, and its files, from these fixtures.
 */
export const SESSION_STORE_REV = "5e5510a";

function changedFile(
  path: string,
  old: string | undefined,
  next: string | undefined,
): ChangedFile {
  const { hunks } = parseDiffFromFile(
    { name: path, contents: old ?? "" },
    { name: path, contents: next ?? "" },
  );
  return {
    path,
    status:
      old === undefined ? "added" : next === undefined ? "deleted" : "modified",
    additions: hunks.reduce((sum, hunk) => sum + hunk.additionLines, 0),
    deletions: hunks.reduce((sum, hunk) => sum + hunk.deletionLines, 0),
    binary: false,
    contents: { old, new: next },
  };
}

export const sessionStoreChanges: Changes = {
  rev: SESSION_STORE_REV,
  title: "Store login sessions in Postgres",
  files: [
    changedFile("migrations/0004_sessions.sql", undefined, migrationAfter),
    changedFile("src/db.ts", dbBefore, dbAfter),
    changedFile(
      "src/middleware/requireSession.ts",
      requireSessionBefore,
      requireSessionAfter,
    ),
    changedFile("src/routes/login.ts", loginBefore, loginAfter),
    changedFile("src/sessions/memory.ts", memoryBefore, undefined),
    changedFile("src/sessions/store.ts", undefined, storeAfter),
  ],
};

/** The pull request's files as they are after it, for references without a commit. */
export const sessionStoreFiles: Record<string, string> = {
  "migrations/0004_sessions.sql": migrationAfter,
  "src/db.ts": dbAfter,
  "src/middleware/requireSession.ts": requireSessionAfter,
  "src/routes/login.ts": loginAfter,
  "src/sessions/store.ts": storeAfter,
};
