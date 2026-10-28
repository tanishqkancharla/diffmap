export type CodeNote = {
  target:
    | { kind: "lines"; start: number; end: number }
    | { kind: "symbol"; symbol: string };
  text: string;
};

/** A symbol note's match on one line: `[start, end)` columns. */
export type SymbolMatch = { start: number; end: number; note: CodeNote };

const notePrefix = /^\s*(?:\/\/|#|--)\s*\[!note\b/;
const notePattern = /^\s*(?:\/\/|#|--)\s*\[!note\s+([^\]]+?)\s*\]\s*(.*?)\s*$/;
const linesPattern = /^L(\d+)(?:-L(\d+))?$/;
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
  const notes = lines.slice(end).flatMap((line) => {
    if (line.trim() === "") return [];
    const match = notePattern.exec(line);
    if (match === null || match[2] === "")
      return [{ target: { kind: "symbol", symbol: "" }, text: line } as const];
    const lineRange = linesPattern.exec(match[1]!);
    const target: CodeNote["target"] =
      lineRange === null
        ? { kind: "symbol", symbol: match[1]! }
        : {
            kind: "lines",
            start: Number(lineRange[1]),
            end: Number(lineRange[2] ?? lineRange[1]),
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
    if (target.kind === "symbol") {
      if (target.symbol === "")
        return `Invalid note "${note.text.trim()}". Use // [!note symbol] text or // [!note L3-L5] text`;
      if (!lines.some((line) => symbolMatches(line, target.symbol).length > 0))
        return `Note target "${target.symbol}" does not appear in its code fence`;
      continue;
    }
    if (
      target.start < 1 ||
      target.end < target.start ||
      target.end > lines.length
    )
      return `Note lines L${target.start}-L${target.end} are outside the ${lines.length}-line code fence`;
    for (let n = target.start; n <= target.end; n++) {
      if (covered.has(n)) return `Line notes overlap at line ${n}`;
      covered.add(n);
    }
  }
  return undefined;
}

/** Non-overlapping symbol note matches on one line, left to right. */
export function lineSymbolMatches(line: string, notes: CodeNote[]) {
  const matches = notes
    .flatMap((note) =>
      note.target.kind === "symbol"
        ? symbolMatches(line, note.target.symbol).map((start) => ({
            start,
            end:
              start +
              (note.target.kind === "symbol" ? note.target.symbol.length : 0),
            note,
          }))
        : [],
    )
    .toSorted((a, b) => a.start - b.start || b.end - a.end);
  const kept: SymbolMatch[] = [];
  for (const match of matches) {
    const last = kept.at(-1);
    if (last === undefined || match.start >= last.end) kept.push(match);
  }
  return kept;
}

/** Start columns of `symbol` in `line`, as a whole word where it starts or ends with an identifier character. */
function symbolMatches(line: string, symbol: string) {
  const starts: number[] = [];
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
    starts.push(at);
  }
  return starts;
}
