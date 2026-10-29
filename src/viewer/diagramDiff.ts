const edgeSelector =
  ".edge, .edge-label, .message, .class-relationship, .er-relationship";

/**
 * Marks what changed in a `mermaid diff`. `svg` draws every line; `today`
 * and `proposed` draw each side alone. A node or edge missing from Proposed
 * gets data-change="-", one missing from Today "+", and a node whose label
 * differs between the sides "~".
 */
export function markDiagramChanges(
  svg: string,
  sides: { today: string; proposed: string },
) {
  const document = parse(svg);
  const today = parse(sides.today);
  const proposed = parse(sides.proposed);

  const todayNodes = nodeLabels(today);
  const proposedNodes = nodeLabels(proposed);
  for (const node of document.querySelectorAll("[data-id]")) {
    const id = node.getAttribute("data-id");
    if (!proposedNodes.has(id)) node.setAttribute("data-change", "-");
    else if (!todayNodes.has(id)) node.setAttribute("data-change", "+");
    else if (todayNodes.get(id) !== proposedNodes.get(id))
      node.setAttribute("data-change", "~");
  }
  // A removed sequence participant takes its lifeline with it.
  for (const lifeline of document.querySelectorAll("[data-actor]")) {
    const id = lifeline.getAttribute("data-actor");
    if (!proposedNodes.has(id)) lifeline.setAttribute("data-change", "-");
    else if (!todayNodes.has(id)) lifeline.setAttribute("data-change", "+");
  }

  const todayEdges = edgeKeys(today);
  const proposedEdges = edgeKeys(proposed);
  for (const edge of document.querySelectorAll(edgeSelector)) {
    const key = edgeKey(edge);
    if (!proposedEdges.has(key)) edge.setAttribute("data-change", "-");
    else if (!todayEdges.has(key)) edge.setAttribute("data-change", "+");
  }
  return document.documentElement.outerHTML;
}

function parse(svg: string) {
  return new DOMParser().parseFromString(svg, "image/svg+xml");
}

function nodeLabels(document: Document) {
  return new Map(
    [...document.querySelectorAll("[data-id]")].map((node) => [
      node.getAttribute("data-id"),
      node.getAttribute("data-label"),
    ]),
  );
}

/** An edge, edge label, or message by its kind, ends, and label. */
function edgeKey(edge: Element) {
  return [
    edge.getAttribute("class"),
    edge.getAttribute("data-from"),
    edge.getAttribute("data-to"),
    edge.getAttribute("data-label") ?? "",
  ].join("\u0000");
}

function edgeKeys(document: Document) {
  return new Set([...document.querySelectorAll(edgeSelector)].map(edgeKey));
}
