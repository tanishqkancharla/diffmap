import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DiffmapFileError, DiffmapShareError } from "./errors.js";
import { extractTitle } from "./extractDocument.js";
import { extractGistId, gistViewerUrl } from "./gist/route.ts";
import { GIST_CHANGES_FILE, GIST_FILES_FILE } from "./changes.js";
import { readSourceReference } from "./definitions.js";
import { readChanges, readDocumentChanges } from "./git.js";
import {
  collectFences,
  parseViewerDocument,
  type ViewerDocument,
} from "./parseViewer.js";

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
  // An uncommitted changes card shows the tree as it is when you share.
  for (const { rev } of parsed.changeCards) {
    if (changes.has(rev)) continue;
    const loaded = await readChanges(input.workspaceRoot, rev);
    if (loaded instanceof Error) return loaded;
    changes.set(rev, loaded);
  }
  // It has no files either, so excerpts and references without a commit read these.
  const files = readDocumentFiles(input.workspaceRoot, parsed);
  if (files instanceof Error) return files;

  const auth = await runGh(["auth", "status"]);
  if (auth instanceof DiffmapShareError) return auth;

  const args = ["gist", "create"];
  if (input.isPublic) args.push("--public");
  args.push("--desc", extractTitle(source), filePath);
  const snapshots = [
    { name: GIST_CHANGES_FILE, value: Object.fromEntries(changes) },
    { name: GIST_FILES_FILE, value: files },
  ].filter((snapshot) => Object.keys(snapshot.value).length > 0);
  const snapshotDir =
    snapshots.length === 0
      ? undefined
      : await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-share-"));
  if (snapshotDir !== undefined) {
    for (const snapshot of snapshots) {
      const snapshotPath = path.join(snapshotDir, snapshot.name);
      await fs.writeFile(snapshotPath, JSON.stringify(snapshot.value));
      args.push(snapshotPath);
    }
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

/** Current contents of every file an excerpt or a reference without a commit reads, by path. */
function readDocumentFiles(root: string, document: ViewerDocument) {
  const paths = new Set<string>();
  for (const reference of document.references) {
    if (reference.kind === "file" && reference.rev === undefined)
      paths.add(reference.path);
  }
  for (const fence of collectFences(document.nodes)) {
    if (fence.kind === "file") paths.add(fence.path);
  }
  const files: Record<string, string> = {};
  for (const filePath of paths) {
    const read = readSourceReference(
      root,
      new URLSearchParams({ path: filePath }),
    );
    if (read instanceof Error) return read;
    files[filePath] = read.contents;
  }
  return files;
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
