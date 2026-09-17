import * as errore from "errore";
import { parsePatchFiles, type CodeViewDiffItem } from "@pierre/diffs";
import { parseAST } from "md4x/napi";
import type { ComarkElement, ComarkNode } from "md4x/napi";
import { DiffmapAnnotationError, DiffmapParseError } from "./errors.js";
import { parseMermaidDiagram } from "./mermaid.js";
import { parseFence, type Fence } from "./parseFence.js";

export type ViewerDocument = {
  nodes: ViewerNode[];
  headings: ViewerHeading[];
  sourceDiffs: CodeViewDiffItem[];
  hasReferences: boolean;
};

export type ViewerHeading = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  id: string;
};

export type ViewerNode = ViewerText | ViewerElement | ViewerHtml | ViewerView;

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
};

export function parseViewerDocument(source: string, path = "spec") {
  const tree = errore.try({
    try: () => parseAST(source),
    catch: (cause) => new DiffmapParseError({ cause }),
  });
  if (tree instanceof Error) return tree;
  const nodes = tree.nodes.flatMap(fromNode);
  const fences = collectFences(nodes);
  const sourceDiffs: CodeViewDiffItem[] = [];
  for (const fence of fences) {
    if (fence.kind !== "source-diff") continue;
    if (sourceDiffs.some((diff) => diff.id === fence.id)) {
      return new DiffmapAnnotationError({
        reason: `Duplicate source diff ID "${fence.id}"`,
      });
    }
    const patches = errore.try({
      try: () => parsePatchFiles(fence.source, undefined, true),
      catch: (cause) =>
        new DiffmapAnnotationError({
          reason: `Invalid patch "${fence.id}"`,
          cause,
        }),
    });
    if (patches instanceof Error) return patches;
    const files = patches.flatMap((patch) => patch.files);
    const fileDiff = files[0];
    if (
      files.length !== 1 ||
      fileDiff === undefined ||
      fileDiff.hunks.length === 0
    ) {
      return new DiffmapAnnotationError({
        reason: `Source diff "${fence.id}" must contain one file with unified diff hunks`,
      });
    }
    if (fileDiff.name !== fence.path) {
      return new DiffmapAnnotationError({
        reason: `Source diff "${fence.id}" path does not match its patch (${fileDiff.name})`,
      });
    }
    sourceDiffs.push({ id: fence.id, type: "diff", fileDiff });
  }
  const annotations = fences.flatMap((fence) => {
    if (fence.kind === "callstack") return fence.lines;
    if (fence.kind === "mermaid")
      return fence.annotations.map((link) => link.annotation);
    return [];
  });
  const mermaidFences = fences.flatMap((fence) =>
    fence.kind === "mermaid" ? [fence] : [],
  );
  for (const [offset, fence] of mermaidFences.entries()) {
    const mermaidIndex = offset + 1;
    const parsedMermaid = parseMermaidDiagram({
      source: fence.source,
      path,
      where: mermaidWhere(source, mermaidIndex),
    });
    if (parsedMermaid instanceof Error) return parsedMermaid;
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
        reason: `Invalid reference in "${line.text}". Use [[id:old|new:start-end]] or [[path#symbol]]`,
      });
    }
    for (const ref of line.references) {
      if (ref.kind === "file") {
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
        continue;
      }
      const diff = sourceDiffs.find((item) => item.id === ref.id);
      if (diff === undefined) {
        return new DiffmapAnnotationError({
          reason: `Unknown source diff "${ref.id}"`,
        });
      }
      const inHunk = diff.fileDiff.hunks.some((hunk) => {
        const start =
          ref.side === "old" ? hunk.deletionStart : hunk.additionStart;
        const count =
          ref.side === "old" ? hunk.deletionCount : hunk.additionCount;
        return ref.start >= start && ref.end < start + count;
      });
      if (
        !Number.isSafeInteger(ref.start) ||
        !Number.isSafeInteger(ref.end) ||
        ref.end < ref.start ||
        !inHunk
      ) {
        return new DiffmapAnnotationError({
          reason: `Range ${ref.side}:${ref.start}-${ref.end} is not in a hunk of "${ref.id}"`,
        });
      }
    }
  }
  return {
    nodes,
    headings: collectHeadings(nodes),
    sourceDiffs,
    hasReferences: annotations.some(
      (annotation) => annotation.references.length > 0,
    ),
  };
}

function collectFences(nodes: ViewerNode[]): Fence[] {
  return nodes.flatMap((node) => {
    if (node.type === "view") return [node.fence];
    if (node.type === "element") return collectFences(node.children);
    return [];
  });
}

function mermaidWhere(source: string, index: number) {
  const line = mermaidFenceLine(source, index);
  if (line === undefined) return `diagram ${index}`;
  return `diagram ${index}, line ${line}`;
}

function mermaidFenceLine(source: string, index: number) {
  const match = [...source.matchAll(/^[ \t]*(`{3,}mermaid\b|::mermaid\b)/gm)][
    index - 1
  ];
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
  if (node.type !== "element") return "";
  return node.children.map(viewerNodeText).join("");
}

function fromNode(node: ComarkNode): ViewerNode[] {
  if (!Array.isArray(node)) {
    return [{ type: "text", value: node }];
  }
  const converted = fromElement(node);
  if (converted === undefined) return [];
  if (Array.isArray(converted)) return converted;
  return [converted];
}

function fromElement(
  element: ComarkElement,
): ViewerNode | ViewerNode[] | undefined {
  const [tag, , ...children] = element;
  if (tag === null) return undefined;
  if (tag === "template") return children.flatMap(fromNode);
  if (tag === "pre") {
    return fenceView(stringAttr(element, "language"), comarkText(children));
  }
  if (tag === "mermaid") return fenceView("mermaid", comarkText(children));
  if (tag === "callstack") return fenceView("callstack", comarkText(children));
  if (tag === "diff") {
    const path = stringAttr(element, "path");
    const lang = path === undefined ? "diff" : `diff:${path}`;
    return fenceView(lang, comarkText(children));
  }
  if (tag === "file") return fileView(element, children);
  if (tag === "html") return htmlView(element, children);
  const convertedChildren = children.flatMap(fromNode);
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

function fenceView(lang: string | undefined, source: string): ViewerView {
  return {
    type: "view",
    fence: parseFence(lang === undefined ? "" : lang, source),
  };
}

function fileView(
  element: ComarkElement,
  children: ComarkNode[],
): ViewerView | ViewerNode[] {
  const path = stringAttr(element, "path");
  if (path === undefined) return children.flatMap(fromNode);
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
  };
}

function stringAttr(element: ComarkElement, key: string) {
  const value = element[1][key];
  if (value === undefined) return undefined;
  // SAFETY: md4x string attributes are JSON strings.
  return value as string;
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
