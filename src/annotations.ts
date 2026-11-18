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

/** Finds valid [[references]] and removed patch syntax, preserving route brackets. */
export function* sourceReferenceMatches(text: string) {
  const first = text.indexOf("[[");
  if (first === -1) return;

  // Pair brackets once so recovery never rescans an unfinished suffix.
  const closes = new Map<number, number>();
  const stack: number[] = [];
  for (let index = first; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\n" || char === "\r") stack.length = 0;
    if (char === "[") stack.push(index);
    if (char === "]" && stack.length > 0) closes.set(stack.pop()!, index);
  }

  // Invalid nested candidates must also be rejected without rescanning their
  // paths: revs cannot contain brackets, nor can symbol/line fragments.
  const nextSeparator = new Int32Array(text.length + 1);
  const nextBracket = new Int32Array(text.length + 1);
  nextSeparator[text.length] = nextBracket[text.length] = text.length;
  for (let index = text.length - 1; index >= first; index -= 1) {
    const char = text[index];
    nextSeparator[index] =
      char === ":" || char === "#" ? index : nextSeparator[index + 1]!;
    nextBracket[index] =
      char === "[" || char === "]" ? index : nextBracket[index + 1]!;
  }

  const removed = /[\w-]+:(old|new):\d/y;
  for (let index = first; index < text.length - 1; index += 1) {
    if (text[index] !== "[" || text[index + 1] !== "[") continue;
    const close = closes.get(index);
    if (close === undefined || closes.get(index + 1) !== close - 1) continue;
    const start = index + 2;
    const end = close - 1;
    if (start === end) continue;

    let separator = nextSeparator[start]!;
    let possible = true;
    if (separator < end && text[separator] === ":") {
      possible =
        nextBracket[start]! >= separator &&
        isCommitRev(text.slice(start, separator));
      if (possible) separator = nextSeparator[separator + 1]!;
    }
    if (
      separator < end &&
      (text[separator] !== "#" || nextBracket[separator + 1]! < end)
    )
      possible = false;
    const reference = possible
      ? parseReference(text.slice(start, end))
      : undefined;
    removed.lastIndex = start;
    if (reference === undefined && !removed.test(text)) continue;
    yield { index, end: close + 1, reference };
    // Only accepted references consume their nested bracket candidates.
    index = close;
  }
}

export function parseAnnotation(line: string): SourceAnnotation {
  const references: SourceReference[] = [];
  let text = "";
  let last = 0;
  for (const match of sourceReferenceMatches(line)) {
    const reference = match.reference;
    if (reference === undefined) continue;
    text += line.slice(last, match.index).replace(/\s*$/, "");
    references.push(reference);
    last = match.end;
  }
  return { text: text + line.slice(last), references };
}

export function parseReference(value: string): SourceReference | undefined {
  const revMatch = /^([^:#[\]\n]+):(.+)$/.exec(value);
  const rev =
    revMatch !== null && isCommitRev(revMatch[1]!) ? revMatch[1] : undefined;
  const target = rev === undefined ? value : revMatch![2]!;
  const file = /^([^#:\r\n]+)(?:#(.+))?$/.exec(target);
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
