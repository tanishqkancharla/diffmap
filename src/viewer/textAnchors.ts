import type { TextAnchor } from "./comments.ts";

/** Characters of context kept on each side of a quote to tell repeats apart. */
const CONTEXT = 32;

/** The page's text: every text node under the root, in order, joined. */
export type TextIndex = {
  text: string;
  nodes: { node: Text; start: number }[];
};

export function textIndex(root: Element): TextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: TextIndex["nodes"] = [];
  let text = "";
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    // SAFETY: the walker only visits text nodes.
    const textNode = node as Text;
    nodes.push({ node: textNode, start: text.length });
    text += textNode.data;
  }
  return { text, nodes };
}

export function anchorFromRange(
  root: Element,
  range: Range,
  display: string,
): TextAnchor | undefined {
  const { text } = textIndex(root);
  const start = textOffset(root, range.startContainer, range.startOffset);
  const end = textOffset(root, range.endContainer, range.endOffset);
  const quote = text.slice(start, end);
  if (quote.trim() === "") return undefined;
  return {
    kind: "text",
    quote,
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
    offset: start,
    display,
    section: sectionAbove(root, range.startContainer),
  };
}

/** The quote's occurrence whose surroundings match best, nearest its old offset on ties. */
export function rangeForAnchor(
  index: TextIndex,
  anchor: TextAnchor,
): Range | undefined {
  let best: { at: number; score: number; distance: number } | undefined;
  for (
    let at = index.text.indexOf(anchor.quote);
    at !== -1;
    at = index.text.indexOf(anchor.quote, at + 1)
  ) {
    const before = index.text.slice(Math.max(0, at - CONTEXT), at);
    const after = index.text.slice(
      at + anchor.quote.length,
      at + anchor.quote.length + CONTEXT,
    );
    const score =
      sharedSuffix(before, anchor.prefix) + sharedPrefix(after, anchor.suffix);
    const distance = Math.abs(at - anchor.offset);
    if (
      best === undefined ||
      score > best.score ||
      (score === best.score && distance < best.distance)
    ) {
      best = { at, score, distance };
    }
  }
  if (best === undefined) return undefined;
  return rangeAt(index, best.at, best.at + anchor.quote.length);
}

/** The first line box of a range, or the summary of the closed `<details>` hiding it. */
export function anchorRect(range: Range) {
  const node = range.startContainer;
  const element = node instanceof Element ? node : node.parentElement;
  const closed = element?.closest("details:not([open])");
  if (closed !== null && closed !== undefined) {
    return (closed.querySelector("summary") ?? closed).getBoundingClientRect();
  }
  const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
  return rects[0] ?? range.getBoundingClientRect();
}

/** Characters from the root's start to a boundary point, counting text nodes as textIndex does. */
function textOffset(root: Element, container: Node, offset: number) {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(container, offset);
  return range.toString().length;
}

function rangeAt(index: TextIndex, start: number, end: number) {
  const startNode = index.nodes.find(
    (entry) => start < entry.start + entry.node.data.length,
  );
  const endNode = index.nodes.findLast((entry) => end > entry.start);
  if (startNode === undefined || endNode === undefined) return undefined;
  const range = document.createRange();
  range.setStart(startNode.node, start - startNode.start);
  range.setEnd(endNode.node, end - endNode.start);
  return range;
}

function sectionAbove(root: Element, node: Node) {
  const headings = [...root.querySelectorAll("h1, h2, h3, h4, h5, h6")];
  const heading = headings.findLast(
    (candidate) =>
      candidate.contains(node) ||
      (candidate.compareDocumentPosition(node) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0,
  );
  const text = heading?.textContent?.trim();
  return text === "" ? undefined : text;
}

function sharedPrefix(a: string, b: string) {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length])
    length++;
  return length;
}

function sharedSuffix(a: string, b: string) {
  let length = 0;
  while (
    length < a.length &&
    length < b.length &&
    a[a.length - 1 - length] === b[b.length - 1 - length]
  )
    length++;
  return length;
}
