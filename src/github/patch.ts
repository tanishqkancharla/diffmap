import type { ChangedFile } from "../changes.ts";

/** A file from GitHub's commit, compare, or pull-files APIs. */
export type GitHubFile = {
  filename: string;
  previous_filename?: string;
  status: string;
  additions?: number;
  deletions?: number;
  patch?: string;
};

/** Wrap a GitHub file `patch` (hunks only) as a unified diff Pierre can parse. */
export function wrapGitHubPatch(file: GitHubFile) {
  if (file.patch === undefined || file.patch.length === 0) return undefined;
  const oldPath = file.previous_filename ?? file.filename;
  const newPath = file.filename;
  const oldHeader = file.status === "added" ? "/dev/null" : `a/${oldPath}`;
  const newHeader = file.status === "removed" ? "/dev/null" : `b/${newPath}`;
  return [
    `diff --git a/${oldPath} b/${newPath}`,
    `--- ${oldHeader}`,
    `+++ ${newHeader}`,
    file.patch,
  ].join("\n");
}

export function githubChangedFiles(files: GitHubFile[]): ChangedFile[] {
  return files.map((file) => {
    const patch = wrapGitHubPatch(file);
    return {
      path: file.filename,
      ...(file.previous_filename === undefined
        ? {}
        : { prevPath: file.previous_filename }),
      status:
        file.status === "added"
          ? "added"
          : file.status === "removed"
            ? "deleted"
            : file.status === "renamed"
              ? "renamed"
              : "modified",
      additions: file.additions ?? 0,
      deletions: file.deletions ?? 0,
      // GitHub omits the patch for binary and very large files.
      binary: patch === undefined,
      ...(patch === undefined ? {} : { patch }),
    };
  });
}
