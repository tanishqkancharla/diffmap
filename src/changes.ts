import {
  parseDiffFromFile,
  parsePatchFiles,
  type CodeViewDiffItem,
} from "@pierre/diffs";

/**
 * A set of changes the diff panel can show: one commit (`a1b2c3d`), a commit
 * range (`a1b2c3d..e4f5a6b`), uncommitted changes (`working`, `staged`,
 * `unstaged`), a range that ends in them (`a1b2c3d..staged`,
 * `a1b2c3d..working`), or `all` changes the range picker lists.
 */
export type Rev = string;

export const WORKING: Rev = "working";
export const STAGED: Rev = "staged";
export const UNSTAGED: Rev = "unstaged";
export const ALL: Rev = "all";

const shaPattern = "[0-9a-f]{7,40}";
const commitRevPattern = new RegExp(`^${shaPattern}(?:\\.\\.${shaPattern})?$`);
const revPattern = new RegExp(
  `^(?:working|staged|unstaged|all|${shaPattern}(?:\\.\\.(?:${shaPattern}|staged|working))?)$`,
);

/** Revs a reference can name: commits and commit ranges. */
export function isCommitRev(value: string) {
  return commitRevPattern.test(value);
}

export function isRev(value: string) {
  return revPattern.test(value);
}

export function shortRev(rev: Rev) {
  if (rev === WORKING) return "Uncommitted";
  if (rev === STAGED) return "Staged";
  if (rev === UNSTAGED) return "Unstaged";
  if (rev === ALL) return "All commits";
  return rev
    .split("..")
    .map((part) =>
      part === STAGED || part === WORKING ? part : part.slice(0, 7),
    )
    .join("..");
}

/** One row of the range picker, newest first: unstaged, staged, then commits. */
export type Delta =
  | { kind: "unstaged" | "staged"; additions: number; deletions: number }
  | {
      kind: "commit";
      sha: string;
      /** First parent, or the empty tree for a root commit. */
      parent: string;
      subject: string;
      additions: number;
      deletions: number;
    };

export type DeltasResponse = { deltas?: Delta[]; error?: string };

/** Picked rows, as indexes into the delta list: `newest <= oldest`. */
export type DeltaWindow = { newest: number; oldest: number };

/**
 * The rev for picked rows. A window is always explicit, even when it covers
 * every row: `all` is resolved against the default list, which may be shorter
 * than one extended to reach an older rev.
 */
export function windowRev(deltas: Delta[], window: DeltaWindow): Rev {
  const newest = deltas[window.newest]!;
  const oldest = deltas[window.oldest]!;
  if (window.newest === window.oldest)
    return newest.kind === "commit" ? newest.sha : newest.kind;
  // Only unstaged through staged: everything uncommitted.
  if (oldest.kind !== "commit") return WORKING;
  const head =
    newest.kind === "commit"
      ? newest.sha
      : newest.kind === "staged"
        ? STAGED
        : WORKING;
  return `${oldest.parent}..${head}`;
}

const same = (full: string, short: string) => full.startsWith(short);

/** The rows a rev covers, or undefined when the list cannot show it. */
export function revWindow(deltas: Delta[], rev: Rev): DeltaWindow | undefined {
  if (rev === ALL) return { newest: 0, oldest: deltas.length - 1 };
  if (rev === UNSTAGED) return { newest: 0, oldest: 0 };
  if (rev === STAGED) return { newest: 1, oldest: 1 };
  if (rev === WORKING) return { newest: 0, oldest: 1 };
  const [first, second] = rev.split("..");
  if (second === undefined) {
    const index = deltas.findIndex(
      (delta) => delta.kind === "commit" && same(delta.sha, first!),
    );
    return index === -1 ? undefined : { newest: index, oldest: index };
  }
  const oldest = deltas.findIndex(
    (delta) => delta.kind === "commit" && same(delta.parent, first!),
  );
  const newest =
    second === WORKING
      ? 0
      : second === STAGED
        ? 1
        : deltas.findIndex(
            (delta) => delta.kind === "commit" && same(delta.sha, second),
          );
  if (oldest === -1 || newest === -1 || newest > oldest) return undefined;
  return { newest, oldest };
}

function deltaName(delta: Delta) {
  if (delta.kind === "commit") return delta.sha.slice(0, 7);
  return delta.kind === "staged" ? "Staged" : "Unstaged";
}

/** "All commits", one commit's title, Unstaged or Staged, or `<oldest>…<newest>` for a range. */
export function windowLabel(deltas: Delta[], window: DeltaWindow) {
  if (window.newest === 0 && window.oldest === deltas.length - 1)
    return "All commits";
  const newest = deltas[window.newest]!;
  if (window.newest === window.oldest)
    return newest.kind === "commit" ? newest.subject : deltaName(newest);
  return `${deltaName(deltas[window.oldest]!)}…${deltaName(newest)}`;
}

export type ChangedFile = {
  path: string;
  /** Present when git detected a rename. */
  prevPath?: string;
  status: "added" | "deleted" | "modified" | "renamed";
  additions: number;
  deletions: number;
  binary: boolean;
  /**
   * Full contents make every line reachable. Hosted GitHub viewers only get
   * the hunk patch from the API.
   */
  /** A missing side means the file did not exist there. */
  contents?: { old?: string; new?: string };
  patch?: string;
};

export type Changes = {
  rev: Rev;
  title: string;
  /** Web page for these changes, such as a GitHub commit. */
  url?: string;
  /** GitHub listed only the first files; `url` has the rest. */
  truncated?: boolean;
  files: ChangedFile[];
};

/** Gist file holding the changes a shared spec references, keyed by rev. */
export const GIST_CHANGES_FILE = "diffmap-changes.json";

export type ChangesResponse = { changes?: Changes; error?: string };

/** jsdiff's default lines of context around each change. */
const CONTEXT = 4;

/**
 * Binary files have neither contents nor a patch, so they have no diff item.
 * With `focus`, the diff keeps enough unchanged context to show those new-side
 * lines; its version is the context it needed.
 */
export function changedFileItem(
  file: ChangedFile,
  focus?: { start: number; end: number },
): CodeViewDiffItem | undefined {
  if (file.contents === undefined) {
    const fileDiff =
      file.patch === undefined
        ? undefined
        : parsePatchFiles(file.patch, undefined, false)[0]?.files[0];
    return fileDiff === undefined
      ? undefined
      : { id: file.path, type: "diff", fileDiff };
  }
  const { old, new: next } = file.contents;
  const parse = (context: number) =>
    parseDiffFromFile(
      old === undefined
        ? // oxlint-disable-next-line unicorn/no-null -- Pierre uses null for a missing side.
          null
        : { name: file.prevPath ?? file.path, contents: old },
      next === undefined
        ? // oxlint-disable-next-line unicorn/no-null -- Pierre uses null for a missing side.
          null
        : { name: file.path, contents: next },
      { context },
    );
  let context = CONTEXT;
  let fileDiff = parse(context);
  const lines = next === undefined ? 0 : next.split("\n").length;
  if (focus !== undefined) {
    while (context < lines && !shows(fileDiff.hunks, focus)) {
      context *= 4;
      fileDiff = parse(context);
    }
  }
  return {
    id: file.path,
    type: "diff",
    fileDiff,
    ...(context === CONTEXT ? {} : { version: context }),
  };
}

/** Whether every focused new-side line falls inside a hunk, rather than a collapsed gap. */
function shows(
  hunks: { additionStart: number; additionCount: number }[],
  focus: { start: number; end: number },
) {
  for (let line = focus.start; line <= focus.end; line++) {
    const inside = hunks.some(
      (hunk) =>
        line >= hunk.additionStart &&
        line < hunk.additionStart + hunk.additionCount,
    );
    if (!inside) return false;
  }
  return true;
}
