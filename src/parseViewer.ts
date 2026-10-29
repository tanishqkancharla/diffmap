import * as errore from "errore";
import { parseAST } from "md4x/napi";
import type { ComarkElement, ComarkNode } from "md4x/napi";
import {
  parseReference,
  referenceLabel,
  type SourceAnnotation,
  type SourceReference,
} from "./annotations.js";
import { isRev, type Rev } from "./changes.js";
import { notesProblem } from "./codeNotes.js";
import {
  DiffmapAnnotationError,
  DiffmapParseError,
  DiffmapServicesError,
} from "./errors.js";
import { parseMermaidDiagram } from "./mermaid.js";
import { parseFence, type Fence } from "./parseFence.js";
import { serviceAnnotations } from "./services.js";

export type ViewerDocument = {
  nodes: ViewerNode[];
  headings: ViewerHeading[];
  /** Every reference in stacks, diagrams, and prose. */
  references: SourceReference[];
  /** `changes` fences, in document order. */
  changeCards: ChangeCard[];
};

/** A `changes` fence's rev and the paths it lists to review first. */
export type ChangeCard = { rev: Rev; review: string[] };

export type ViewerHeading = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  id: string;
};

export type ViewerNode =
  | ViewerText
  | ViewerElement
  | ViewerHtml
  | ViewerView
  | ViewerReference;

export type ViewerText = {
  type: "text";
  value: string;
};

export type ViewerElement = {
  type: "element";
  tag: string;
  attrs: ViewerElementAttrs;
  children: ViewerNode[];
};

export type ViewerHtml = {
  type: "html";
  block: boolean;
  source: string;
};

export type ViewerView = {
  type: "view";
  fence: Fence;
};

/** A `[[path#symbol]]` in prose. The annotation text is the short label. */
export type ViewerReference = {
  type: "reference";
  annotation: SourceAnnotation;
};

export type ViewerElementAttrs = {
  id: string | undefined;
  href: string | undefined;
  src: string | undefined;
  alt: string | undefined;
  title: string | undefined;
  className: string | undefined;
  start: number | undefined;
  checked: boolean | undefined;
  task: boolean | undefined;
  alertType: string | undefined;
  align: string | undefined;
  /** The label of an MDC `::details{summary="…"}` toggle. */
  summary: string | undefined;
};

export function parseViewerDocument(source: string, path = "spec") {
  const tree = errore.try({
    try: () => parseAST(source),
    catch: (cause) => new DiffmapParseError({ cause }),
  });
  if (tree instanceof Error) return tree;
  const nodes = tree.nodes.flatMap((node) => fromNode(node));
  const fences = collectFences(nodes);
  const changeCards: ChangeCard[] = [];
  for (const fence of fences) {
    if (fence.kind === "code" && fence.lang.startsWith("source-diff")) {
      return new DiffmapAnnotationError({
        reason: `"${fence.lang}" fences were removed. Commit the change, then use a changes fence with the commit SHA and link lines with [[<sha>:path#L12-L30]]`,
      });
    }
    if (fence.kind === "code" || fence.kind === "callstack") {
      const problem = notesProblem({
        // Call stack symbols must appear in the row text readers see, not in a hidden [[reference]].
        lines:
          fence.kind === "code"
            ? fence.source.split("\n")
            : fence.lines.map((line) => line.text),
        highlights: fence.highlights,
        notes: fence.notes,
      });
      if (problem !== undefined)
        return new DiffmapAnnotationError({ reason: problem });
      continue;
    }
    if (fence.kind !== "changes") continue;
    if (!isRev(fence.rev)) {
      return new DiffmapAnnotationError({
        reason: `Invalid changes "${fence.rev}". Use a commit SHA, a SHA range (a1b2c3d..e4f5a6b), or leave it empty for uncommitted changes`,
      });
    }
    const duplicate = fence.review.find(
      (reviewPath, index) => fence.review.indexOf(reviewPath) !== index,
    );
    if (duplicate !== undefined) {
      return new DiffmapAnnotationError({
        reason: `changes "${fence.rev}" lists ${duplicate} twice. List each file to review once`,
      });
    }
    changeCards.push({ rev: fence.rev, review: fence.review });
  }
  const annotations = [
    ...fences.flatMap((fence) => {
      if (fence.kind === "callstack") return fence.lines;
      if (fence.kind === "mermaid")
        return fence.annotations.map((link) => link.annotation);
      if (fence.kind === "services" && fence.parsed.ok)
        return serviceAnnotations(fence.parsed.diagram);
      return [];
    }),
    ...collectReferences(nodes),
  ];
  const servicesFences = fences.flatMap((fence) =>
    fence.kind === "services" ? [fence] : [],
  );
  for (const [offset, fence] of servicesFences.entries()) {
    if (fence.parsed.ok) continue;
    const start = fenceLine(source, "services", offset + 1);
    return new DiffmapServicesError({
      path,
      where:
        start === undefined
          ? `diagram ${offset + 1}, line ${fence.parsed.line}`
          : `line ${start + fence.parsed.line}`,
      reason: fence.parsed.reason,
    });
  }
  const mermaidFences = fences.flatMap((fence) =>
    fence.kind === "mermaid" ? [fence] : [],
  );
  for (const [offset, fence] of mermaidFences.entries()) {
    const mermaidIndex = offset + 1;
    const where = mermaidWhere(source, mermaidIndex);
    // A diff draws every line, and each side must also stand on its own.
    for (const [side, diagram] of [
      ["", fence.source],
      [", Today side", fence.sides?.today],
      [", Proposed side", fence.sides?.proposed],
    ] as const) {
      if (diagram === undefined) continue;
      const parsedMermaid = parseMermaidDiagram({
        source: diagram,
        path,
        where: `${where}${side}`,
      });
      if (parsedMermaid instanceof Error) return parsedMermaid;
    }
    const targets = new Set<string>();
    for (const link of fence.annotations) {
      const target = `${link.target}:${link.id}`;
      if (
        targets.has(target) ||
        link.annotation.references.length === 0 ||
        (link.target === "edge" && !/^(0|[1-9]\d*)$/.test(link.id))
      ) {
        return new DiffmapAnnotationError({
          reason: `Invalid or duplicate Mermaid reference for ${target}`,
        });
      }
      targets.add(target);
    }
  }
  for (const line of annotations) {
    if (line.text.includes("[[")) {
      return new DiffmapAnnotationError({
        reason: `Invalid reference in "${line.text}". Use [[path]], [[path#symbol]], [[path#L12-L30]], or [[<commit>:path#L12-L30]]; source-diff patch references were removed`,
      });
    }
    for (const ref of line.references) {
      if (ref.kind !== "file") continue;
      if (ref.rev !== undefined && ref.symbol !== undefined) {
        return new DiffmapAnnotationError({
          reason: `Symbol references read current files. Use a line range with a commit: [[${ref.rev}:${ref.path}#L12-L30]]`,
        });
      }
      if (
        ref.start !== undefined &&
        (!Number.isSafeInteger(ref.start) ||
          !Number.isSafeInteger(ref.end) ||
          ref.end! < ref.start)
      ) {
        return new DiffmapAnnotationError({
          reason: `Invalid file range in "${ref.path}"`,
        });
      }
    }
  }
  return {
    nodes,
    headings: collectHeadings(nodes),
    references: annotations.flatMap((annotation) => annotation.references),
    changeCards,
  };
}

export function collectFences(nodes: ViewerNode[]): Fence[] {
  return nodes.flatMap((node) => {
    if (node.type === "view") return [node.fence];
    if (node.type === "element") return collectFences(node.children);
    return [];
  });
}

function collectReferences(nodes: ViewerNode[]): SourceAnnotation[] {
  return nodes.flatMap((node) => {
    if (node.type === "reference") return [node.annotation];
    if (node.type === "element") return collectReferences(node.children);
    return [];
  });
}

function mermaidWhere(source: string, index: number) {
  const line = fenceLine(source, "mermaid", index);
  if (line === undefined) return `diagram ${index}`;
  return `diagram ${index}, line ${line}`;
}

/** Line of the `index`th (1-based) fence or MDC block named `lang`. */
function fenceLine(source: string, lang: string, index: number) {
  const pattern = new RegExp(
    String.raw`^[ \t]*(\`{3,}${lang}\b|::${lang}\b)`,
    "gm",
  );
  const match = [...source.matchAll(pattern)][index - 1];
  if (match === undefined || match.index === undefined) return undefined;
  return source.slice(0, match.index).split("\n").length;
}

const headingTags = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function collectHeadings(nodes: ViewerNode[]): ViewerHeading[] {
  const headings: ViewerHeading[] = [];
  const usedIds = new Set<string>();
  walkHeadings(nodes, headings, usedIds);
  return headings;
}

function walkHeadings(
  nodes: ViewerNode[],
  headings: ViewerHeading[],
  usedIds: Set<string>,
) {
  for (const node of nodes) {
    if (node.type !== "element") continue;
    if (headingTags.has(node.tag)) {
      const text = viewerNodeText(node);
      const id = ensureHeadingId(node, text, usedIds);
      headings.push({
        level: headingLevel(node.tag),
        text,
        id,
      });
      continue;
    }
    walkHeadings(node.children, headings, usedIds);
  }
}

function headingLevel(tag: string): ViewerHeading["level"] {
  if (tag === "h1") return 1;
  if (tag === "h2") return 2;
  if (tag === "h3") return 3;
  if (tag === "h4") return 4;
  if (tag === "h5") return 5;
  return 6;
}

function ensureHeadingId(
  node: ViewerElement,
  text: string,
  usedIds: Set<string>,
) {
  const existing = node.attrs.id;
  if (existing !== undefined && existing !== "") {
    usedIds.add(existing);
    return existing;
  }
  const id = uniqueHeadingId(text, usedIds);
  node.attrs.id = id;
  return id;
}

function uniqueHeadingId(text: string, usedIds: Set<string>) {
  const base =
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "heading";
  let id = base;
  let n = 1;
  while (usedIds.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  usedIds.add(id);
  return id;
}

function viewerNodeText(node: ViewerNode): string {
  if (node.type === "text") return node.value;
  if (node.type === "reference") return node.annotation.text;
  if (node.type !== "element") return "";
  return node.children.map(viewerNodeText).join("");
}

function fromNode(node: ComarkNode, literal = false): ViewerNode[] {
  if (!Array.isArray(node)) {
    return literal ? [{ type: "text", value: node }] : proseText(node);
  }
  const converted = fromElement(node, literal);
  if (converted === undefined) return [];
  if (Array.isArray(converted)) return converted;
  return [converted];
}

/** Splits `[[path#symbol]]` references out of prose text. */
function proseText(value: string): ViewerNode[] {
  const nodes: ViewerNode[] = [];
  let last = 0;
  for (const match of value.matchAll(/\[\[([^[\]\n]+)\]\]/g)) {
    const reference = parseReference(match[1]!);
    // The removed `[[id:old|new:N]]` patch syntax must fail, not render as text.
    const removed =
      reference === undefined && /^[\w-]+:(old|new):\d/.test(match[1]!);
    if (reference === undefined && !removed) continue;
    if (match.index > last)
      nodes.push({ type: "text", value: value.slice(last, match.index) });
    nodes.push({
      type: "reference",
      annotation:
        reference === undefined
          ? { text: match[0], references: [] }
          : { text: referenceLabel(reference, true), references: [reference] },
    });
    last = match.index + match[0].length;
  }
  if (last < value.length)
    nodes.push({ type: "text", value: value.slice(last) });
  return nodes;
}

function fromElement(
  element: ComarkElement,
  literal: boolean,
): ViewerNode | ViewerNode[] | undefined {
  const [tag, , ...children] = element;
  if (tag === null) return undefined;
  // Code spans show the syntax literally; links cannot nest a button.
  const literalChildren = literal || tag === "code" || tag === "a";
  if (tag === "template")
    return children.flatMap((child) => fromNode(child, literalChildren));
  if (tag === "pre") {
    // md4x parses ```ts [src/request.ts] into `filename`; diffmap shows it as the title.
    return fenceView(
      stringAttr(element, "language"),
      comarkText(children),
      highlightsAttr(element),
      stringAttr(element, "filename"),
      stringAttr(element, "meta"),
    );
  }
  if (tag === "mermaid")
    return fenceView(
      "mermaid",
      comarkText(children),
      undefined,
      stringAttr(element, "title"),
    );
  if (tag === "callstack")
    return fenceView(
      "callstack",
      comarkText(children),
      undefined,
      stringAttr(element, "title"),
    );
  if (tag === "changes") {
    const rev = stringAttr(element, "rev");
    const body = comarkText(children);
    return fenceView("changes", rev === undefined ? body : `${rev}\n${body}`);
  }
  if (tag === "diff") {
    const path = stringAttr(element, "path");
    const lang = path === undefined ? "diff" : `diff:${path}`;
    return fenceView(lang, comarkText(children));
  }
  if (tag === "file") return fileView(element, children);
  if (tag === "html") return htmlView(element, children);
  const convertedChildren = children.flatMap((child) =>
    fromNode(child, literalChildren),
  );
  return {
    type: "element",
    tag,
    attrs: elementAttrs(element),
    children:
      tag === "li" && element[1].task === true
        ? unwrapTaskParagraph(convertedChildren)
        : convertedChildren,
  };
}

function unwrapTaskParagraph(children: ViewerNode[]): ViewerNode[] {
  const first = children[0];
  if (
    children.length === 1 &&
    first !== undefined &&
    first.type === "element" &&
    first.tag === "p"
  ) {
    return first.children;
  }
  return children;
}

function fenceView(
  lang: string | undefined,
  source: string,
  highlights?: number[],
  title?: string,
  meta?: string,
): ViewerView {
  return {
    type: "view",
    fence: parseFence(
      lang === undefined ? "" : lang,
      source,
      highlights,
      title,
      meta,
    ),
  };
}

function fileView(
  element: ComarkElement,
  children: ComarkNode[],
): ViewerView | ViewerNode[] {
  const path = stringAttr(element, "path");
  if (path === undefined) return children.flatMap((child) => fromNode(child));
  const start = lineAttr(element, "start");
  const end = lineAttr(element, "end");
  // MDC ::file with no range loads the whole file.
  return fenceView(
    `${start === undefined ? 1 : start}:${end === undefined ? Number.MAX_SAFE_INTEGER : end}:${path}`,
    comarkText(children),
  );
}

function htmlView(
  element: ComarkElement,
  children: ComarkNode[],
): ViewerHtml | ViewerView {
  const source = comarkText(children);
  if (children.every((child) => !Array.isArray(child))) {
    return {
      type: "html",
      block: element[1].block === true,
      source,
    };
  }
  return {
    type: "view",
    fence: parseFence("html", source),
  };
}

function elementAttrs(element: ComarkElement): ViewerElementAttrs {
  const checked = element[1].checked;
  return {
    id: stringAttr(element, "id"),
    href: stringAttr(element, "href"),
    src: stringAttr(element, "src"),
    alt: stringAttr(element, "alt"),
    title: stringAttr(element, "title"),
    className: stringAttr(element, "class"),
    start: lineAttr(element, "start"),
    checked: checked === true ? true : checked === false ? false : undefined,
    task: element[1].task === true ? true : undefined,
    alertType: stringAttr(element, "type"),
    align: stringAttr(element, "align"),
    summary: stringAttr(element, "summary"),
  };
}

function stringAttr(element: ComarkElement, key: string) {
  const value = element[1][key];
  if (value === undefined) return undefined;
  // SAFETY: md4x string attributes are JSON strings.
  return value as string;
}

/** md4x parses ```ts {2,4-5} into `highlights: [2, 4, 5]`. */
function highlightsAttr(element: ComarkElement) {
  const value = element[1].highlights;
  if (!Array.isArray(value)) return undefined;
  return value.filter((line): line is number => typeof line === "number");
}

function lineAttr(element: ComarkElement, key: string) {
  const value = stringAttr(element, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}

function comarkText(nodes: ComarkNode[]): string {
  return nodes
    .map((node) => {
      if (!Array.isArray(node)) return node;
      const [, , ...children] = node;
      return comarkText(children);
    })
    .join("");
}
