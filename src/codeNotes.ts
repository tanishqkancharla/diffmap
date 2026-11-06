export type CodeNote = {
  target:
    | { kind: "lines"; start: number; end: number }
    | {
        kind: "symbol";
        symbol: string;
        lines?: { start: number; end: number };
      };
  text: string;
};

/** A symbol note's match on one line: `[start, end)` columns. */
export type SymbolMatch = { start: number; end: number; note: CodeNote };

const notePrefix = /^\s*(?:\/\/|#|--)\s*\[!note\b/;
const notePattern = /^\s*(?:\/\/|#|--)\s*\[!note\s+([^\]]+?)\s*\]\s*(.*?)\s*$/;
const linesPattern = /^L(\d+)(?:-L(\d+))?(?:\s+(.+))?$/;
const identifierChar = /[\w$]/;

/**
 * Splits trailing `// [!note target] text` lines off a code fence. Blank
 * lines between notes are allowed; note-like lines above other code stay
 * code, so fences that document this syntax render unchanged.
 */
export function parseCodeNotes(source: string) {
  const lines = source.split("\n");
  let end = lines.length;
  while (
    end > 0 &&
    (lines[end - 1]!.trim() === "" || notePrefix.test(lines[end - 1]!))
  )
    end--;
  const notes = lines.slice(end).flatMap<CodeNote>((line) => {
    if (line.trim() === "") return [];
    const match = notePattern.exec(line);
    if (match === null || match[2] === "")
      return [{ target: { kind: "symbol", symbol: "" }, text: line } as const];
    const lineRange = linesPattern.exec(match[1]!);
    const target: CodeNote["target"] =
      lineRange === null
        ? { kind: "symbol", symbol: match[1]! }
        : lineRange[3] === undefined
          ? {
              kind: "lines",
              start: Number(lineRange[1]),
              end: Number(lineRange[2] ?? lineRange[1]),
            }
          : {
              kind: "symbol",
              symbol: lineRange[3],
              lines: {
                start: Number(lineRange[1]),
                end: Number(lineRange[2] ?? lineRange[1]),
              },
            };
    return [{ target, text: match[2]! }];
  });
  return { code: lines.slice(0, end).join("\n"), notes };
}

/** Why a fence's highlights or notes are invalid, or undefined. `lines` is the rendered text of each line or row. */
export function notesProblem(fence: {
  lines: string[];
  highlights: number[];
  notes: CodeNote[];
}) {
  const lines = fence.lines;
  const highlight = fence.highlights.find((n) => n < 1 || n > lines.length);
  if (highlight !== undefined)
    return `Highlighted line ${highlight} is outside the ${lines.length}-line code fence`;
  const covered = new Set<number>();
  for (const note of fence.notes) {
    const target = note.target;
    const range = target.kind === "lines" ? target : target.lines;
    if (
      range !== undefined &&
      (range.start < 1 || range.end < range.start || range.end > lines.length)
    )
      return `Note lines L${range.start}-L${range.end} are outside the ${lines.length}-line code fence`;
    if (target.kind === "symbol") {
      if (target.symbol === "")
        return `Invalid note "${note.text.trim()}". Use // [!note symbol] text or // [!note L3-L5] text`;
      const scopedLines =
        range === undefined ? lines : lines.slice(range.start - 1, range.end);
      if (
        !scopedLines.some(
          (line) => symbolStart(line, target.symbol) !== undefined,
        )
      )
        return `Note target "${target.symbol}" does not appear in its code fence${range === undefined ? "" : ` on lines L${range.start}-L${range.end}`}`;
      continue;
    }
    for (let n = target.start; n <= target.end; n++) {
      if (covered.has(n)) return `Line notes overlap at line ${n}`;
      covered.add(n);
    }
  }
  return undefined;
}

/** First whole-word occurrence of each eligible symbol note on a 1-based line. */
export function lineSymbolMatches(
  line: string,
  notes: CodeNote[],
  row: number,
) {
  const matches = notes
    .flatMap((note) => {
      const target = note.target;
      if (
        target.kind !== "symbol" ||
        (target.lines !== undefined &&
          (row < target.lines.start || row > target.lines.end))
      )
        return [];
      const start = symbolStart(line, target.symbol);
      return start === undefined
        ? []
        : [{ start, end: start + target.symbol.length, note }];
    })
    .toSorted(
      (a, b) =>
        a.start - b.start ||
        b.end - a.end ||
        Number(
          b.note.target.kind === "symbol" && b.note.target.lines !== undefined,
        ) -
          Number(
            a.note.target.kind === "symbol" &&
              a.note.target.lines !== undefined,
          ),
    );
  const kept: SymbolMatch[] = [];
  for (const match of matches) {
    const last = kept.at(-1);
    if (last === undefined || match.start >= last.end) kept.push(match);
  }
  return kept;
}

/** First whole-word start column, respecting identifier boundaries. */
function symbolStart(line: string, symbol: string) {
  for (
    let at = line.indexOf(symbol);
    at !== -1;
    at = line.indexOf(symbol, at + 1)
  ) {
    const before = line[at - 1];
    const after = line[at + symbol.length];
    const wordStart = identifierChar.test(symbol[0]!);
    const wordEnd = identifierChar.test(symbol.at(-1)!);
    if (wordStart && before !== undefined && identifierChar.test(before))
      continue;
    if (wordEnd && after !== undefined && identifierChar.test(after)) continue;
    return at;
  }
  return undefined;
}
