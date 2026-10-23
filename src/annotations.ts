import { isCommitRev, shortRev, type Rev } from "./changes.js";

/**
 * A file, symbol, or line range. With a commit `rev`, the panel opens that
 * commit's changes and line numbers refer to the file after the commit.
 * Without one, it opens uncommitted changes, or the current file when the
 * file has none.
 */
type FileReference = {
  kind: "file";
  rev?: Rev;
  path: string;
  symbol?: string;
  start?: number;
  end?: number;
};

/** Every file in a rev, such as a changes card's Review button. */
type ChangesReference = {
  kind: "changes";
  rev: Rev;
  path?: string;
};

export type SourceReference = FileReference | ChangesReference;

export type SourceAnnotation = {
  text: string;
  references: SourceReference[];
  /** Source panel title while selected, such as a call stack row without its tree. */
  title?: string;
};

export function parseCallStack(source: string): SourceAnnotation[] {
  return source.split("\n").map((line) => {
    const annotation = parseAnnotation(line);
    return {
      ...annotation,
      title: callStackRow(annotation.text).description.trim(),
    };
  });
}

/** A call stack row's change mark, tree prefix, and the call it describes. */
export function callStackRow(text: string) {
  const sign = text.startsWith("+") ? "+" : text.startsWith("-") ? "-" : " ";
  const label = text.replace(/^[+ -]/, "");
  const tree = /^[ \t│┃├└─]*/u.exec(label)![0];
  return { sign, tree, description: label.slice(tree.length) };
}

export function parseAnnotation(line: string): SourceAnnotation {
  const references: SourceReference[] = [];
  const text = line.replace(
    /\s*\[\[([^[\]\n]+)\]\]/g,
    (match, value: string) => {
      const reference = parseReference(value);
      if (reference === undefined) return match;
      references.push(reference);
      return "";
    },
  );
  return { text, references };
}

export function parseReference(value: string): SourceReference | undefined {
  const revMatch = /^([^:#[\]\n]+):(.+)$/.exec(value);
  const rev =
    revMatch !== null && isCommitRev(revMatch[1]!) ? revMatch[1] : undefined;
  const target = rev === undefined ? value : revMatch![2]!;
  const file = /^([^#:[\]\n]+)(?:#(.+))?$/.exec(target);
  if (file === null || file[1]!.trim().length === 0) return undefined;
  const path = file[1]!.trim();
  const fragment = file[2];
  const base =
    rev === undefined
      ? { kind: "file" as const, path }
      : { kind: "file" as const, rev, path };
  if (fragment === undefined) return base;
  const range = /^L([1-9]\d*)(?:-L?([1-9]\d*))?$/.exec(fragment);
  if (range !== null)
    return {
      ...base,
      start: Number(range[1]),
      end: Number(range[2] === undefined ? range[1] : range[2]),
    };
  if (!/^[\w$]+(?:\.[\w$]+)*$/.test(fragment)) return undefined;
  return { ...base, symbol: fragment };
}

/** Short label; pass `basename` for inline prose. */
export function referenceLabel(reference: SourceReference, basename = false) {
  if (reference.kind === "changes") return shortRev(reference.rev);
  const path = basename ? reference.path.split("/").pop()! : reference.path;
  const rev = reference.rev === undefined ? "" : `${shortRev(reference.rev)}:`;
  if (reference.symbol !== undefined)
    return `${rev}${path}#${reference.symbol}`;
  if (reference.start !== undefined)
    return `${rev}${path}#L${reference.start}-L${reference.end}`;
  return `${rev}${path}`;
}

export type SourceNavigation = {
  selectedAnnotation: SourceAnnotation | undefined;
  onSelectAnnotation: (annotation: SourceAnnotation) => void;
};
