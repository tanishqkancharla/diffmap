import { parseDiffFromFile } from "@pierre/diffs";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  ALL,
  STAGED,
  UNSTAGED,
  WORKING,
  isCommitRev,
  isRev,
  type Delta,
  type ChangedFile,
  type Changes,
  type Rev,
} from "./changes.js";
import { DiffmapGitError } from "./errors.js";
import type { ViewerDocument } from "./parseViewer.js";

const execFileAsync = promisify(execFile);

/** `git hash-object -t tree /dev/null`: the parent of a root commit. */
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/** One end of a diff: a commit (or the empty tree), the index, or the worktree. */
type Side = string | typeof INDEX | typeof WORKTREE;
const INDEX = Symbol("index");
const WORKTREE = Symbol("worktree");

/** Reads the files changed by a rev, with full old and new contents. */
export async function readChanges(
  root: string,
  rev: Rev,
): Promise<Changes | DiffmapGitError> {
  if (!isRev(rev))
    return new DiffmapGitError({
      reason: `"${rev}" is not a commit SHA, a SHA range, or one of working, staged, unstaged, all.`,
    });
  const window = await resolveRev(root, rev);
  if (window instanceof Error) return window;
  const files = await diffSides(root, window.base, window.head);
  if (files instanceof Error) return files;
  return { rev, title: window.title, files };
}

async function resolveRev(
  root: string,
  rev: Rev,
): Promise<{ base: Side; head: Side; title: string } | DiffmapGitError> {
  if (rev === WORKING)
    return { base: "HEAD", head: WORKTREE, title: "Uncommitted changes" };
  if (rev === STAGED)
    return { base: "HEAD", head: INDEX, title: "Staged changes" };
  if (rev === UNSTAGED)
    return { base: INDEX, head: WORKTREE, title: "Unstaged changes" };
  if (rev === ALL) {
    const deltas = await listDeltas(root);
    if (deltas instanceof Error) return deltas;
    const oldest = deltas.at(-1);
    return {
      base: oldest?.kind === "commit" ? oldest.parent : "HEAD",
      head: WORKTREE,
      title: "All commits",
    };
  }
  const [first, second] = rev.split("..");
  if (second === undefined) {
    const head = await resolveCommit(root, first!);
    if (head instanceof Error) return head;
    const title = await git(root, ["log", "-1", "--format=%s", head]);
    if (title instanceof Error) return title;
    return { base: await parentOf(root, head), head, title: title.trim() };
  }
  const base = await resolveCommit(root, first!);
  if (base instanceof Error) return base;
  const head =
    second === STAGED
      ? INDEX
      : second === WORKING
        ? WORKTREE
        : await resolveCommit(root, second);
  if (head instanceof Error) return head;
  const count = await git(root, [
    "rev-list",
    "--count",
    `${base}..${typeof head === "string" ? head : "HEAD"}`,
  ]);
  if (count instanceof Error) return count;
  const commits = `${count.trim()} ${count.trim() === "1" ? "commit" : "commits"}`;
  const tail =
    head === INDEX ? " + staged" : head === WORKTREE ? " + uncommitted" : "";
  return {
    base,
    head,
    title: `${shortSha(base)}..${typeof head === "string" ? shortSha(head) : second} · ${commits}${tail}`,
  };
}

async function diffSides(root: string, base: Side, head: Side) {
  // `git diff A B`, `git diff --cached A`, `git diff A`, and `git diff` cover commit→commit, →index, →worktree, and index→worktree.
  const range =
    typeof head === "string"
      ? [base as string, head]
      : head === INDEX
        ? ["--cached", base as string]
        : base === INDEX
          ? []
          : [base as string];
  const numstat = await git(root, [
    "diff",
    "-M",
    "--numstat",
    "-z",
    // Paths relative to root, which may sit below the repository's top level.
    "--relative",
    ...range,
  ]);
  if (numstat instanceof Error) return numstat;
  const read = (side: Side, file: string) =>
    side === WORKTREE
      ? readWorktree(root, file)
      : showBlob(root, side === INDEX ? "" : side, file);
  const tracked = parseNumstat(numstat).map((entry) =>
    withContents(
      entry,
      read(base, entry.prevPath ?? entry.path),
      read(head, entry.path),
    ),
  );
  if (head !== WORKTREE) return Promise.all(tracked);
  const untracked = await git(root, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  if (untracked instanceof Error) return untracked;
  const files = await Promise.all(tracked);
  for (const file of untracked.split("\0").filter((name) => name.length > 0)) {
    const contents = await read(WORKTREE, file);
    const binary = contents === undefined || contents.includes("\0");
    // A path removed from the index but kept on disk is both a tracked deletion and untracked.
    const index = files.findIndex((entry) => entry.path === file);
    const old = index === -1 ? undefined : files[index]!.contents?.old;
    if (index !== -1) files.splice(index, 1);
    if (old === contents) continue;
    files.push({
      path: file,
      status: old === undefined ? "added" : "modified",
      ...(binary
        ? { additions: 0, deletions: 0, binary }
        : { ...lineCounts(old, contents), binary }),
      ...(binary ? {} : { contents: { old, new: contents } }),
    });
  }
  return files;
}

/** Lines added and removed between two versions, for files git does not diff itself. */
function lineCounts(old: string | undefined, next: string) {
  if (old === undefined) return { additions: countLines(next), deletions: 0 };
  return parseDiffFromFile(
    { name: "old", contents: old },
    { name: "new", contents: next },
  ).hunks.reduce(
    (sum, hunk) => ({
      additions: sum.additions + hunk.additionLines,
      deletions: sum.deletions + hunk.deletionLines,
    }),
    { additions: 0, deletions: 0 },
  );
}

/** A symlink reads as its target path, as git stores it, never the file it points to. */
async function readWorktree(root: string, file: string) {
  const full = path.join(root, file);
  const stat = await fs.lstat(full).catch(() => undefined);
  if (stat === undefined) return undefined;
  if (stat.isSymbolicLink()) return fs.readlink(full);
  return fs.readFile(full, "utf8").catch(() => undefined);
}

type NumstatEntry = {
  path: string;
  prevPath?: string;
  additions: number;
  deletions: number;
  binary: boolean;
};

/** Parses `git diff --numstat -z`, where renames put both paths after the counts. */
export function parseNumstat(output: string): NumstatEntry[] {
  const tokens = output.split("\0");
  const entries: NumstatEntry[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const match = /^(-|\d+)\t(-|\d+)\t(.*)$/.exec(tokens[index]!);
    if (match === null) continue;
    const binary = match[1] === "-";
    const counts = {
      additions: binary ? 0 : Number(match[1]),
      deletions: binary ? 0 : Number(match[2]),
      binary,
    };
    if (match[3] !== "") {
      entries.push({ path: match[3]!, ...counts });
      continue;
    }
    entries.push({
      prevPath: tokens[index + 1]!,
      path: tokens[index + 2]!,
      ...counts,
    });
    index += 2;
  }
  return entries;
}

async function withContents(
  entry: NumstatEntry,
  readOld: Promise<string | undefined>,
  readNew: Promise<string | undefined>,
): Promise<ChangedFile> {
  const [oldContents, newContents] = await Promise.all([readOld, readNew]);
  const status =
    oldContents === undefined
      ? "added"
      : newContents === undefined
        ? "deleted"
        : entry.prevPath === undefined
          ? "modified"
          : "renamed";
  return {
    ...entry,
    status,
    ...(entry.binary
      ? {}
      : { contents: { old: oldContents, new: newContents } }),
  };
}

/** Returns undefined when the path does not exist there. An empty commit reads the index. */
async function showBlob(root: string, commit: string, file: string) {
  if (commit === EMPTY_TREE) return undefined;
  const contents = await git(root, ["show", `${commit}:./${file}`]);
  return contents instanceof Error ? undefined : contents;
}

async function resolveCommit(root: string, sha: string) {
  if (sha === EMPTY_TREE) return sha;
  const resolved = await git(root, [
    "rev-parse",
    "--verify",
    "--quiet",
    `${sha}^{commit}`,
  ]);
  if (resolved instanceof Error)
    return new DiffmapGitError({
      reason: `Commit ${sha} is not in this repository.`,
    });
  return resolved.trim();
}

async function parentOf(root: string, commit: string) {
  const parent = await git(root, [
    "rev-parse",
    "--verify",
    "--quiet",
    `${commit}^`,
  ]);
  return parent instanceof Error ? EMPTY_TREE : parent.trim();
}

async function git(root: string, args: string[]) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64_000_000,
    });
    return result.stdout;
  } catch (cause) {
    return new DiffmapGitError({
      reason: `git ${args[0]} failed in ${root}`,
      cause,
    });
  }
}

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

function countLines(contents: string) {
  if (contents.length === 0) return 0;
  return contents.split("\n").length - (contents.endsWith("\n") ? 1 : 0);
}

/**
 * The range picker's rows, newest first: unstaged and staged changes, then
 * this branch's commits since it left the default branch. On the default
 * branch itself, the last 20 commits.
 */
export async function listDeltas(
  root: string,
  /** The open rev; the list reaches back far enough to show it. */
  include?: Rev,
): Promise<Delta[] | DiffmapGitError> {
  const [unstaged, staged, untracked] = await Promise.all([
    git(root, ["diff", "--numstat", "-z", "--relative"]),
    git(root, ["diff", "--cached", "--numstat", "-z", "--relative"]),
    git(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  if (unstaged instanceof Error) return unstaged;
  if (staged instanceof Error) return staged;
  if (untracked instanceof Error) return untracked;
  const untrackedLines = await Promise.all(
    untracked
      .split("\0")
      .filter((file) => file.length > 0)
      .map(async (file) => {
        const contents = await readWorktree(root, file);
        return contents === undefined || contents.includes("\0")
          ? 0
          : countLines(contents);
      }),
  );
  const unstagedTotals = totals(parseNumstat(unstaged));
  const deltas: Delta[] = [
    {
      kind: "unstaged",
      additions:
        unstagedTotals.additions +
        untrackedLines.reduce((sum, n) => sum + n, 0),
      deletions: unstagedTotals.deletions,
    },
    { kind: "staged", ...totals(parseNumstat(staged)) },
  ];
  const branch = await defaultBranch(root);
  const base =
    branch === undefined
      ? undefined
      : await git(root, ["merge-base", "HEAD", branch]);
  const branchCommits =
    base === undefined || base instanceof Error
      ? []
      : await logCommits(root, ["-n", "100", `${base.trim()}..HEAD`]);
  if (branchCommits instanceof Error) return branchCommits;
  const commits =
    branchCommits.length > 0
      ? branchCommits
      : await logCommits(root, ["-n", "20", "HEAD"]);
  // A repository without commits has nothing to log.
  if (commits instanceof Error) return deltas;
  const reached = await reachRev(root, commits, include);
  return [...deltas, ...reached];
}

/**
 * Extends the commit rows down to an older rev, so the picker can always show
 * what is open. A commit off HEAD's first-parent line gets its own last row.
 */
async function reachRev(root: string, commits: Delta[], rev: Rev | undefined) {
  if (rev === undefined || !/^[0-9a-f]{7,40}/.test(rev)) return commits;
  const [first = "", second] = rev.split("..");
  // A range starts after its base; a single commit is its own oldest row.
  const target =
    second === undefined
      ? commits.find(
          (delta) => delta.kind === "commit" && delta.sha.startsWith(first),
        )
      : commits.find(
          (delta) => delta.kind === "commit" && delta.parent.startsWith(first),
        );
  if (target !== undefined) return commits;
  const ancestor = await git(root, [
    "merge-base",
    "--is-ancestor",
    first,
    "HEAD",
  ]);
  const count = await git(root, [
    "rev-list",
    "--first-parent",
    "--count",
    `${first}..HEAD`,
  ]);
  if (!(ancestor instanceof Error) && !(count instanceof Error)) {
    const needed = Number(count.trim()) + (second === undefined ? 1 : 0);
    if (needed > commits.length && needed <= 1000) {
      const longer = await logCommits(root, ["-n", String(needed), "HEAD"]);
      if (longer instanceof Error) return commits;
      const found = longer.some(
        (delta) =>
          delta.kind === "commit" &&
          (second === undefined
            ? delta.sha.startsWith(first)
            : delta.parent.startsWith(first)),
      );
      if (found) return longer;
    }
  }
  if (second !== undefined) return commits;
  const single = await logCommits(root, ["-1", first]);
  return single instanceof Error ? commits : [...commits, ...single];
}

async function defaultBranch(root: string) {
  const remote = await git(root, ["rev-parse", "--abbrev-ref", "origin/HEAD"]);
  if (!(remote instanceof Error) && remote.trim() !== "origin/HEAD")
    return remote.trim();
  for (const name of ["main", "master"]) {
    const local = await git(root, ["rev-parse", "--verify", "--quiet", name]);
    if (!(local instanceof Error)) return name;
  }
  return undefined;
}

async function logCommits(root: string, args: string[]) {
  const log = await git(root, [
    "log",
    // The rail is one line of history, so windows are contiguous.
    "--first-parent",
    "--numstat",
    "--relative",
    "--format=%x1e%H%x1f%P%x1f%s",
    ...args,
  ]);
  if (log instanceof Error) return log;
  return log
    .split("\x1e")
    .filter((record) => record.trim().length > 0)
    .map((record): Delta => {
      const [header = "", ...stats] = record.split("\n");
      const [sha = "", parents = "", subject = ""] = header.split("\x1f");
      const counts = totals(
        parseNumstat(stats.filter((line) => line.length > 0).join("\0")),
      );
      return {
        kind: "commit",
        sha,
        parent: parents.split(" ")[0] || EMPTY_TREE,
        subject,
        ...counts,
      };
    });
}

function totals(entries: NumstatEntry[]) {
  return entries.reduce(
    (sum, entry) => ({
      additions: sum.additions + entry.additions,
      deletions: sum.deletions + entry.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
}

/**
 * Loads every commit rev a document uses and checks that each commit
 * reference names a changed file and a range inside its new version.
 */
export async function readDocumentChanges(
  root: string,
  document: Pick<ViewerDocument, "references" | "changeRevs">,
): Promise<Map<Rev, Changes> | DiffmapGitError> {
  // Uncommitted revs are read live; only commits are checked and snapshotted.
  const revs = new Set<Rev>(document.changeRevs.filter(isCommitRev));
  for (const reference of document.references) {
    if (reference.kind === "changes" || reference.rev !== undefined)
      revs.add(reference.rev!);
  }
  const loaded = new Map<Rev, Changes>();
  for (const rev of revs) {
    const changes = await readChanges(root, rev);
    if (changes instanceof Error) return changes;
    loaded.set(rev, changes);
  }
  for (const reference of document.references) {
    if (reference.kind !== "file" || reference.rev === undefined) continue;
    const file = loaded
      .get(reference.rev)!
      .files.find((item) => item.path === reference.path);
    const label = `[[${reference.rev}:${reference.path}]]`;
    if (file === undefined)
      return new DiffmapGitError({
        reason: `${label}: ${reference.path} is not changed in ${reference.rev}.`,
      });
    if (reference.end === undefined) continue;
    const lines =
      file.contents?.new === undefined ? 0 : countLines(file.contents.new);
    if (reference.end > lines)
      return new DiffmapGitError({
        reason: `${label}: line ${String(reference.end)} is past the end of ${reference.path} (${String(lines)} lines) after ${reference.rev}.`,
      });
  }
  return loaded;
}
