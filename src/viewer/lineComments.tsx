import type {
  DiffLineAnnotation,
  LineAnnotation,
  SelectedLineRange,
} from "@pierre/diffs";
import { fontFamily, spacing } from "maui";
import { style, useStyles } from "purse-styles";
import { CommentCard } from "./CommentCard.tsx";
import { useMemo } from "react";
import {
  useComments,
  type CommentStore,
  type LinesAnchor,
} from "./comments.ts";

const DRAFT = "draft";

/**
 * Comments on lines in one Pierre view. `target` names the view, so a comment
 * only shows in the view it was made in. Each comment shows under its last line.
 */
export function useLineComments(target: string) {
  const store = useComments();
  return useMemo(() => lineCommentsFor(store, target), [store, target]);
}

function lineCommentsFor(store: CommentStore, target: string) {
  const forPath = (path: string) => [
    ...store.comments.flatMap((comment) =>
      comment.anchor.kind === "lines" &&
      comment.anchor.target === target &&
      comment.anchor.path === path
        ? [{ id: comment.id, anchor: comment.anchor }]
        : [],
    ),
    ...(store.draft?.kind === "lines" &&
    store.draft.target === target &&
    store.draft.path === path
      ? [{ id: DRAFT, anchor: store.draft }]
      : []),
  ];
  return {
    diffAnnotations: (path: string): DiffLineAnnotation<string>[] =>
      forPath(path).map(({ id, anchor }) => ({
        side: anchor.side ?? "additions",
        lineNumber: anchor.end,
        metadata: id,
      })),
    fileAnnotations: (path: string): LineAnnotation<string>[] =>
      forPath(path).map(({ id, anchor }) => ({
        lineNumber: anchor.end,
        metadata: id,
      })),
    start: (anchor: Omit<LinesAnchor, "kind" | "target">) =>
      store.startDraft({ kind: "lines", target, ...anchor }),
  };
}

/** The lines a gutter + click or drag covers, on one side. */
export function commentedLines(range: SelectedLineRange) {
  const side = range.endSide ?? range.side;
  // A selection across both sides of a unified diff keeps only its last line.
  const oneSide = (range.side ?? side) === side;
  return {
    side,
    start: oneSide ? Math.min(range.start, range.end) : range.end,
    end: oneSide ? Math.max(range.start, range.end) : range.end,
  };
}

/** A stable 32-bit number for a string. */
export function hashNumber(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash, 33) ^ value.charCodeAt(index);
  }
  return hash >>> 0;
}

export function lineNumbers(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function LineComment(props: { id: string }) {
  const store = useComments();
  const className = useStyles(styles.slot);
  const comment =
    props.id === DRAFT
      ? undefined
      : store.comments.find((candidate) => candidate.id === props.id);
  if (props.id !== DRAFT && comment === undefined) return undefined;
  return (
    <div className={className}>
      <CommentCard comment={comment} />
    </div>
  );
}

const styles = {
  slot: style(spacing.padding({ x: 6, y: 4 }), {
    maxWidth: "560px",
    whiteSpace: "normal",
    // Slotted into Pierre's code, which would otherwise set the font.
    fontFamily,
  }),
};
