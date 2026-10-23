import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DiffmapFileError, DiffmapShareError } from "./errors.js";
import { extractTitle } from "./extractDocument.js";
import { extractGistId, gistViewerUrl } from "./gist/route.ts";
import { GIST_CHANGES_FILE } from "./changes.js";
import { readDocumentChanges } from "./git.js";
import { parseViewerDocument } from "./parseViewer.js";

const execFileAsync = promisify(execFile);

export type ShareResult = {
  gistId: string;
  gistUrl: string;
  viewerUrl: string;
};

export async function shareMarkdownFile(input: {
  filePath: string;
  workspaceRoot: string;
  isPublic: boolean;
}) {
  const filePath = path.resolve(input.filePath);
  const source = await fs.readFile(filePath, "utf8").catch(
    (cause) =>
      new DiffmapFileError({
        path: filePath,
        reason: "read",
        cause,
      }),
  );
  if (source instanceof Error) return source;

  const parsed = parseViewerDocument(source, filePath);
  if (parsed instanceof Error) return parsed;
  // The hosted viewer has no git, so the gist carries a snapshot of each commit.
  const changes = await readDocumentChanges(input.workspaceRoot, parsed);
  if (changes instanceof Error) return changes;

  const auth = await runGh(["auth", "status"]);
  if (auth instanceof DiffmapShareError) return auth;

  const args = ["gist", "create"];
  if (input.isPublic) args.push("--public");
  args.push("--desc", extractTitle(source), filePath);
  const snapshotDir =
    changes.size === 0
      ? undefined
      : await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-share-"));
  if (snapshotDir !== undefined) {
    const snapshot = path.join(snapshotDir, GIST_CHANGES_FILE);
    await fs.writeFile(snapshot, JSON.stringify(Object.fromEntries(changes)));
    args.push(snapshot);
  }

  const created = await runGh(args);
  if (snapshotDir !== undefined)
    await fs.rm(snapshotDir, { recursive: true, force: true });
  if (created instanceof DiffmapShareError) return created;

  const combined = `${created.stderr}\n${created.stdout}`;
  const gistUrl = combined.match(/https:\/\/gist\.github\.com\/[^\s]+/)?.[0];
  if (gistUrl === undefined) {
    return new DiffmapShareError({
      reason: "gh did not print a gist URL",
    });
  }
  const gistId = extractGistId(gistUrl);
  if (gistId === undefined) {
    return new DiffmapShareError({
      reason: `could not parse gist id from ${gistUrl}`,
    });
  }
  return {
    gistId,
    gistUrl,
    viewerUrl: gistViewerUrl(gistId, undefined, process.env.DIFFMAP_ORIGIN),
  };
}

async function runGh(args: string[]) {
  try {
    return await execFileAsync("gh", args, {
      encoding: "utf8",
      maxBuffer: 10_000_000,
    });
  } catch (cause) {
    if (isErrnoException(cause) && cause.code === "ENOENT") {
      return new DiffmapShareError({
        reason:
          "gh is not installed. Install GitHub CLI and run gh auth login.",
      });
    }
    const stderr = execStderr(cause);
    if (stderr.length > 0) {
      return new DiffmapShareError({ reason: stderr.trim() });
    }
    return new DiffmapShareError({
      reason: cause instanceof Error ? cause.message : "gh failed",
    });
  }
}

function isErrnoException(cause: unknown): cause is NodeJS.ErrnoException {
  if (typeof cause !== "object" || !cause) return false;
  return "code" in cause && typeof cause.code === "string";
}

function execStderr(cause: unknown) {
  if (typeof cause !== "object" || !cause) return "";
  if (!("stderr" in cause) || typeof cause.stderr !== "string") return "";
  return cause.stderr;
}
