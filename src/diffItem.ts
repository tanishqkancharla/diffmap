import {
  parseDiffFromFile,
  parsePatchFiles,
  type CodeViewDiffItem,
} from "@pierre/diffs";
import type { ChangedFile } from "./changes.js";

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
