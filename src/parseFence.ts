import { parseCallStack, type SourceAnnotation } from "./annotations.js";
import { WORKING, type Rev } from "./changes.js";
import { parseCodeNotes, type CodeNote } from "./codeNotes.js";
import {
  parseDiagramAnnotations,
  type DiagramAnnotation,
} from "./diagramAnnotations.js";
import { parseServiceDiagram, type ServicesParse } from "./services.js";

export type Fence =
  | {
      kind: "mermaid";
      /** In a diff, every line with its sign removed; see mermaidFence. */
      source: string;
      annotations: DiagramAnnotation[];
      /** From ```mermaid diff: the diagram without `+` lines, and without `-` lines. */
      sides: { today: string; proposed: string } | undefined;
      /** From the info string, as in ```mermaid [Request flow]. */
      title: string | undefined;
    }
  | {
      kind: "services";
      source: string;
      parsed: ServicesParse;
    }
  | { kind: "html"; source: string }
  | {
      kind: "callstack";
      /** Rows with trailing note lines removed. */
      source: string;
      lines: SourceAnnotation[];
      /** 1-based rows from the info string, as in ```callstack {2}. */
      highlights: number[];
      notes: CodeNote[];
      /** From the info string, as in ```callstack [Request flow]. */
      title: string | undefined;
    }
  | {
      kind: "changes";
      rev: Rev;
      /** Paths to review first, in order; other changed files fold away. */
      review: string[];
      source: string;
    }
  | { kind: "file"; path: string; start: number; end: number; source: string }
  | { kind: "diff"; path: string | undefined; source: string }
  | {
      kind: "code";
      lang: string;
      /** Code with trailing note lines removed. */
      source: string;
      /** 1-based lines from the info string, as in ```ts {2,4-6}. */
      highlights: number[];
      notes: CodeNote[];
      /** From the info string, as in ```ts [src/request.ts]. */
      title: string | undefined;
    };

const fileRefPattern = /^(\d+):(\d+):(.+)$/;
const diffPathPattern = /^diff:(.+)$/;

export function isCallStackSource(source: string) {
  return source.includes("└──") || source.includes("├──");
}

export function pathFromDiffSource(source: string) {
  const plus = /^\+\+\+ [ab]\/(.+)$/m.exec(source);
  if (plus?.[1] !== undefined) return plus[1];
  const minus = /^--- [ab]\/(.+)$/m.exec(source);
  if (minus?.[1] !== undefined) return minus[1];
  const comment = /^\/\/ (.+\S)\s*$/m.exec(source);
  if (comment?.[1] !== undefined) return comment[1];
  return undefined;
}

export function parseFence(
  lang: string,
  source: string,
  highlights: number[] = [],
  title?: string,
  /** The info string after the language and highlights, as in ```mermaid diff. */
  meta?: string,
): Fence {
  const trimmed = source.replace(/\n$/, "");
  const diff = meta?.split(/\s+/).includes("diff") ?? false;
  if (lang === "mermaid") return mermaidFence(trimmed, diff, title);
  if (lang === "services")
    return {
      kind: "services",
      source: trimmed,
      parsed: parseServiceDiagram(trimmed, diff),
    };
  if (lang === "html") return { kind: "html", source: trimmed };
  if (lang === "callstack") return callStackFence(trimmed, highlights, title);

  // The first line is the rev (blank for uncommitted); each later line is a path to review.
  if (lang === "changes") {
    const [rev = "", ...paths] = trimmed.split("\n").map((line) => line.trim());
    return {
      kind: "changes",
      rev: rev.length === 0 ? WORKING : rev,
      review: paths.filter((line) => line.length > 0),
      source: trimmed,
    };
  }

  const fileRef = fileRefPattern.exec(lang);
  if (fileRef !== null) {
    return {
      kind: "file",
      start: Number(fileRef[1]),
      end: Number(fileRef[2]),
      path: fileRef[3]!,
      source: trimmed,
    };
  }

  const diffPath = diffPathPattern.exec(lang);
  if (lang === "diff" || diffPath !== null) {
    if (isCallStackSource(trimmed))
      return callStackFence(trimmed, highlights, title);
    return {
      kind: "diff",
      path: diffPath === null ? pathFromDiffSource(trimmed) : diffPath[1],
      source: trimmed,
    };
  }

  const { code, notes } = parseCodeNotes(trimmed);
  return {
    kind: "code",
    lang: lang.length === 0 ? "text" : lang,
    source: code,
    highlights,
    notes,
    title,
  };
}

/**
 * A diff's lines start with `-` (Today only), `+` (Proposed only), or
 * anything else (both). The viewer draws every line, then marks what each
 * side lacks, so Mermaid syntax never needs parsing here.
 */
function mermaidFence(
  source: string,
  diff: boolean,
  title: string | undefined,
): Fence {
  if (!diff)
    return {
      kind: "mermaid",
      source,
      annotations: parseDiagramAnnotations(source),
      sides: undefined,
      title,
    };
  const rows = source.split("\n").map((line) => ({
    sign: line[0],
    text: line.replace(/^[+ -]/, ""),
  }));
  const without = (sign: string) =>
    rows
      .filter((row) => row.sign !== sign)
      .map((row) => row.text)
      .join("\n");
  // Mermaid keeps a node's first label, so within each run of changed lines
  // the `+` lines come first and a relabeled node shows its Proposed label.
  const merged: string[] = [];
  const removed: string[] = [];
  for (const row of rows) {
    if (row.sign === "-") removed.push(row.text);
    else if (row.sign === "+") merged.push(row.text);
    else merged.push(...removed.splice(0), row.text);
  }
  merged.push(...removed);
  return {
    kind: "mermaid",
    source: merged.join("\n"),
    annotations: parseDiagramAnnotations(merged.join("\n")),
    sides: { today: without("+"), proposed: without("-") },
    title,
  };
}

function callStackFence(
  source: string,
  highlights: number[],
  title: string | undefined,
): Fence {
  const { code, notes } = parseCodeNotes(source);
  return {
    kind: "callstack",
    source: code,
    lines: parseCallStack(code),
    highlights,
    notes,
    title,
  };
}
