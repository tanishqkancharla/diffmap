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
      /** Drawn by parseViewerDocument while it checks the diagram and each side; see themeMermaidSvg. */
      svg?: { all: string; today: string; proposed: string } | { all: string };
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
      /** Paths after an `ignore:` line: changed files a reviewer can skip. */
      ignore: string[];
      source: string;
    }
  | {
      kind: "preview";
      /** Storybook story IDs, one per line. */
      stories: string[];
      title: string | undefined;
      source: string;
    }
  | {
      kind: "flow";
      /** The states in source order; the first is where the flow starts. */
      states: FlowState[];
      /** Why the tree is malformed; parseViewerDocument reports it. */
      problem: string | undefined;
      title: string | undefined;
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

export type FlowState = {
  /** The Storybook story ID whose play function reaches this state from its parent. */
  story: string;
  /** The index of the state this one follows, or undefined for the first. */
  parent: number | undefined;
  /** What the person does to get here, as in "Log in". */
  action: string | undefined;
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
  if (lang === "preview")
    return {
      kind: "preview",
      stories: trimmed
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
      title,
      source: trimmed,
    };
  if (lang === "flow")
    return { kind: "flow", ...parseFlow(trimmed), title, source: trimmed };

  // The first line is the rev (blank for uncommitted); each later line is a path to review, or to ignore after an `ignore:` line.
  if (lang === "changes") {
    const [rev = "", ...lines] = trimmed.split("\n").map((line) => line.trim());
    const paths = lines.filter((line) => line.length > 0);
    const split = paths.indexOf("ignore:");
    const ignoreAt = split === -1 ? paths.length : split;
    return {
      kind: "changes",
      rev: rev.length === 0 ? WORKING : rev,
      review: paths.slice(0, ignoreAt),
      ignore: paths.slice(ignoreAt + 1),
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

/**
 * Each line is a story ID, indented under the state it follows, with the action that leads to it after a colon:
 * `auth-log-in--wrong-password: Log in`. The first line is the start and has no action.
 */
export function parseFlow(source: string): {
  states: FlowState[];
  problem: string | undefined;
} {
  const states: FlowState[] = [];
  const open: { indent: number; index: number }[] = [];
  for (const [offset, line] of source.split("\n").entries()) {
    if (line.trim().length === 0) continue;
    const where = `flow line ${offset + 1}`;
    const indent = line.length - line.trimStart().length;
    const colon = line.indexOf(":");
    const story = (colon === -1 ? line : line.slice(0, colon)).trim();
    const action = colon === -1 ? undefined : line.slice(colon + 1).trim();
    while (open.length > 0 && open.at(-1)!.indent >= indent) open.pop();
    const parent = open.at(-1)?.index;
    if (states.length > 0 && parent === undefined)
      return {
        states,
        problem: `${where} is not indented under a state. A flow has one starting state; indent each later state under the one it follows`,
      };
    if (parent === undefined && action !== undefined)
      return {
        states,
        problem: `${where} is the starting state, so it has no action. Write only its story ID`,
      };
    if (parent !== undefined && (action === undefined || action === ""))
      return {
        states,
        problem: `${where} needs the action that leads to it, as in "${story}: Log in"`,
      };
    if (!/^[a-z0-9-]+--[a-z0-9-]+$/.test(story))
      return {
        states,
        problem: `${where}: "${story}" is not a Storybook story ID, which looks like auth-log-in--wrong-password`,
      };
    if (states.some((state) => state.story === story))
      return {
        states,
        problem: `${where} lists ${story} twice. Each state's story is one step from the state above it, so it appears once`,
      };
    states.push({ story, parent, action });
    open.push({ indent, index: states.length - 1 });
  }
  if (states.length === 0)
    return { states, problem: "a flow lists at least its starting story" };
  return { states, problem: undefined };
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
