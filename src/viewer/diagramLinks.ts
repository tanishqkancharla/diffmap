import type { DiagramAnnotation } from "../diagramAnnotations.js";
import { TkstackAnnotationError } from "../errors.js";

export function linkDiagram(svg: string, links: DiagramAnnotation[]) {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  for (const markerPart of document.querySelectorAll("marker *")) {
    if (markerPart.getAttribute("fill") === "var(--_arrow)")
      markerPart.setAttribute("fill", "context-stroke");
    if (markerPart.getAttribute("stroke") === "var(--_arrow)")
      markerPart.setAttribute("stroke", "context-stroke");
  }
  const edges = [
    ...document.querySelectorAll<SVGElement>(
      ".edge, .message, .class-relationship, .er-relationship",
    ),
  ];
  const labels = [...document.querySelectorAll<SVGElement>(".edge-label")];
  for (const [index, link] of links.entries()) {
    const elements =
      link.target === "node"
        ? [...document.querySelectorAll<SVGElement>("[data-id]")].filter(
            (element) => element.dataset.id === link.id,
          )
        : edges.slice(Number(link.id), Number(link.id) + 1);
    if (elements.length === 0)
      return new TkstackAnnotationError({
        reason: `Mermaid ${link.target}:${link.id} does not exist in this diagram.`,
      });
    for (const element of elements) {
      const wrapper = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g",
      );
      element.replaceWith(wrapper);
      wrapper.append(element);
      wrapper.setAttribute("data-source-index", String(index));
      wrapper.setAttribute("class", `source-target source-${link.target}`);
      wrapper.setAttribute("role", "button");
      wrapper.setAttribute("tabindex", "0");
      wrapper.setAttribute("aria-controls", "exploration-panel");
      wrapper.setAttribute("aria-pressed", "false");
      const label = element.getAttribute("data-label");
      wrapper.setAttribute(
        "aria-label",
        `${link.annotation.explanationId ? "Explore" : "Open source"}: ${label === null || label.length === 0 ? link.annotation.text : label}`,
      );
      if (link.target !== "edge") continue;
      const edgeIndex = Number(link.id);
      const sameEdge = (candidate: SVGElement) =>
        candidate.dataset.from === element.dataset.from &&
        candidate.dataset.to === element.dataset.to &&
        candidate.dataset.label === element.dataset.label;
      const occurrence = edges.slice(0, edgeIndex).filter(sameEdge).length;
      const edgeLabel = labels.filter(sameEdge)[occurrence];
      if (edgeLabel !== undefined) wrapper.append(edgeLabel);
      const strokes = element.matches("polyline, path, line")
        ? [element]
        : [...element.querySelectorAll<SVGElement>("line, polyline, path")];
      for (const stroke of strokes) {
        // SAFETY: cloning an SVG element preserves its element type.
        const hit = stroke.cloneNode(true) as SVGElement;
        hit.removeAttribute("marker-start");
        hit.removeAttribute("marker-end");
        hit.setAttribute("class", "source-hit");
        hit.setAttribute("stroke", "transparent");
        hit.setAttribute("stroke-width", "14");
        hit.setAttribute("fill", "none");
        hit.setAttribute("aria-hidden", "true");
        wrapper.prepend(hit);
      }
    }
  }
  return document.documentElement.outerHTML;
}
