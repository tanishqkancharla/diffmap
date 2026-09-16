import { parsePatchFiles, type CodeViewDiffItem } from "@pierre/diffs";

export type GitHubPullFile = {
  filename: string;
  previous_filename?: string;
  status: string;
  patch?: string;
};

/** Wrap a GitHub pull-files `patch` (hunks only) as a unified diff Pierre can parse. */
export function wrapGitHubPullPatch(file: GitHubPullFile) {
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

export function pullFilesToSourceDiffs(files: GitHubPullFile[]) {
  const diffs: CodeViewDiffItem[] = [];
  for (const file of files) {
    const unified = wrapGitHubPullPatch(file);
    if (unified === undefined) continue;
    const patches = parsePatchFiles(unified, undefined, false);
    const fileDiff = patches[0]?.files[0];
    if (fileDiff === undefined || fileDiff.hunks.length === 0) continue;
    diffs.push({
      id: `pr:${file.filename}`,
      type: "diff",
      fileDiff,
    });
  }
  return diffs;
}
