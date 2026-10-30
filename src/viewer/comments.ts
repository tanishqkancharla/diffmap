import { createContext, useContext, useEffect, useMemo, useState } from "react";

/** Text the reader highlighted on the page, found again by its quote and surroundings. */
export type TextAnchor = {
  kind: "text";
  /** The highlighted text as the page's text nodes spell it. */
  quote: string;
  prefix: string;
  suffix: string;
  /** Where the quote started in the page text, to pick between repeats. */
  offset: number;
  /** The highlighted text as the reader saw it, with line breaks. */
  display: string;
  /** The heading above the highlight. */
  section: string | undefined;
};

/** Lines in one Pierre view: an in-page diff or file excerpt, or the Diff panel. */
export type LinesAnchor = {
  kind: "lines";
  /** The view the lines belong to, so a comment only shows where it was made. */
  target: string;
  path: string;
  /** Diff side; undefined for whole files. */
  side: "additions" | "deletions" | undefined;
  /** Line numbers as the view shows them. */
  start: number;
  end: number;
  /** Added to `start` and `end` to get file line numbers, as for a file excerpt. */
  lineOffset: number;
  lines: string[];
  /** What the lines are, such as "diff in the document" or "Diff panel: Uncommitted". */
  context: string;
};

export type CommentAnchor = TextAnchor | LinesAnchor;

export type ReviewComment = {
  id: string;
  body: string;
  anchor: CommentAnchor;
};

export type CommentStore = {
  comments: ReviewComment[];
  /** The comment being written; one at a time. */
  draft: CommentAnchor | undefined;
  /** The comment the reader last clicked, drawn in front of the others. */
  activeId: string | undefined;
  startDraft: (anchor: CommentAnchor) => void;
  cancelDraft: () => void;
  saveDraft: (body: string) => void;
  update: (id: string, body: string) => void;
  remove: (id: string) => void;
  setActiveId: (id: string | undefined) => void;
};

export const CommentsContext = createContext<CommentStore | undefined>(
  undefined,
);

export function useComments() {
  const store = useContext(CommentsContext);
  if (store === undefined) throw new Error("CommentsContext is missing");
  return store;
}

/** Comments for one page, saved in localStorage under `key`. */
export function useCommentStore(key: string): CommentStore {
  const [comments, setComments] = useState(() => loadComments(key));
  const [draft, setDraft] = useState<CommentAnchor>();
  const [activeId, setActiveId] = useState<string>();
  useEffect(() => {
    try {
      if (comments.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(comments));
    } catch (cause) {
      console.warn("diffmap could not save comments", cause);
    }
  }, [key, comments]);
  return useMemo<CommentStore>(
    () => ({
      comments,
      draft,
      activeId,
      startDraft: (anchor) => {
        setDraft(anchor);
        setActiveId(undefined);
      },
      cancelDraft: () => setDraft(undefined),
      saveDraft: (body) => {
        if (draft === undefined) return;
        const id = crypto.randomUUID();
        setComments((current) => [...current, { id, body, anchor: draft }]);
        setDraft(undefined);
        setActiveId(id);
      },
      update: (id, body) =>
        setComments((current) =>
          current.map((comment) =>
            comment.id === id ? { ...comment, body } : comment,
          ),
        ),
      remove: (id) =>
        setComments((current) =>
          current.filter((comment) => comment.id !== id),
        ),
      setActiveId,
    }),
    [comments, draft, activeId],
  );
}

function loadComments(key: string): ReviewComment[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return [];
    // SAFETY: only useCommentStore writes this key, with this shape.
    return JSON.parse(saved) as ReviewComment[];
  } catch {
    return [];
  }
}

/** Every comment as a Markdown list to paste to an agent. */
export function formatComments(input: {
  title: string;
  /** The document's file path or URL. */
  source: string | undefined;
  comments: ReviewComment[];
}): string {
  const heading =
    input.source === undefined
      ? `Review comments on "${input.title}":`
      : `Review comments on "${input.title}" (${input.source}):`;
  const items = input.comments.map((comment, index) => {
    const marker = `${String(index + 1)}. `;
    const indent = " ".repeat(marker.length);
    const block = [
      anchorLocation(comment.anchor),
      ...anchorQuote(comment.anchor),
      "",
      ...comment.body.trim().split("\n"),
    ];
    return block
      .map((line, i) => {
        if (i === 0) return marker + line;
        return line === "" ? "" : indent + line;
      })
      .join("\n");
  });
  return [heading, ...items].join("\n\n") + "\n";
}

function anchorLocation(anchor: CommentAnchor) {
  if (anchor.kind === "text") {
    return anchor.section === undefined
      ? "In the document:"
      : `In "${anchor.section}":`;
  }
  const start = anchor.start + anchor.lineOffset;
  const end = anchor.end + anchor.lineOffset;
  const lines =
    start === end ? String(start) : `${String(start)}-${String(end)}`;
  const side = anchor.side === "deletions" ? ", removed lines" : "";
  return `${anchor.path}:${lines} (${anchor.context}${side}):`;
}

function anchorQuote(anchor: CommentAnchor) {
  if (anchor.kind === "text") {
    return anchor.display
      .trim()
      .split("\n")
      .map((line) => (line.trim() === "" ? ">" : `> ${line}`));
  }
  // A fence longer than any backtick run in the code keeps the code inside it.
  const longestRun = Math.max(
    2,
    ...anchor.lines.map((line) =>
      Math.max(0, ...(line.match(/`+/g) ?? []).map((run) => run.length)),
    ),
  );
  const fence = "`".repeat(longestRun + 1);
  const lang = /\.([a-z0-9]+)$/i.exec(anchor.path)?.[1] ?? "";
  return [`${fence}${lang}`, ...anchor.lines, fence];
}
