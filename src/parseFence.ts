import { parseCallStack, type SourceAnnotation } from "./annotations.js";
import { WORKING, type Rev } from "./changes.js";
import { parseCodeNotes, type CodeNote } from "./codeNotes.js";
import {
  parseDiagramAnnotations,
  type DiagramAnnotation,
} from "./diagramAnnotations.js";
import { parseServiceDiagram, type ServicesParse } from "./services.js";

export type Fence =
  | { kind: "mermaid"; source: string; annotations: DiagramAnnotation[] }
  | { kind: "services"; source: string; parsed: ServicesParse }
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
): Fence {
  const trimmed = source.replace(/\n$/, "");
  if (lang === "mermaid")
    return {
      kind: "mermaid",
      source: trimmed,
      annotations: parseDiagramAnnotations(trimmed),
    };
  if (lang === "services")
    return {
      kind: "services",
      source: trimmed,
      parsed: parseServiceDiagram(trimmed),
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
