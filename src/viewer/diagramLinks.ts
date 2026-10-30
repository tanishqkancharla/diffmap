import { colors } from "maui";
import type { DiagramAnnotation } from "../diagramAnnotations.js";
import { DiffmapAnnotationError } from "../errors.js";

/**
 * Arrowhead colors for edges that are not plain gray: changed in a diff,
 * hovered, or selected. Later tones win when several apply.
 */
const markerTones = [
  ["added", "[data-change='+']", colors.green[9]],
  ["removed", "[data-change='-']", colors.red[9]],
  ["hover", ".source-edge:hover", colors.blue[8]],
  ["selected", ".source-edge[aria-pressed='true']", colors.blue[9]],
] as const;

export function linkDiagram(svg: string, links: DiagramAnnotation[]) {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  colorMarkers(document);
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
      return new DiffmapAnnotationError({
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
      wrapper.setAttribute("aria-controls", "source-diff-panel");
      wrapper.setAttribute("aria-pressed", "false");
      const label = element.getAttribute("data-label");
      wrapper.setAttribute(
        "aria-label",
        `Open source: ${label === null || label.length === 0 ? link.annotation.text : label}`,
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

/**
 * A marker draws in its own colors, not its edge's, and `context-stroke`
 * falls back to black where browsers lack it. So each marker gets one copy
 * per tone, and a style rule swaps an edge to the copy its state needs.
 */
function colorMarkers(document: Document) {
  const rules: string[] = [];
  for (const marker of document.querySelectorAll("marker[id]")) {
    const id = marker.id;
    for (const [tone, , color] of markerTones) {
      // SAFETY: cloning an element preserves its element type.
      const copy = marker.cloneNode(true) as Element;
      copy.id = `${id}--${tone}`;
      paintArrow(copy, color);
      marker.after(copy);
    }
    // Mermaid draws arrowheads in the accent color; match the gray line.
    paintArrow(marker, "var(--_line)");
    for (const end of ["start", "end"]) {
      const uses = `[marker-${end}="url(#${id})"]`;
      if (document.querySelector(uses) === null) continue;
      for (const [tone, state] of markerTones)
        rules.push(
          `:is(${state}, ${state} *)${uses} { marker-${end}: url(#${id}--${tone}); }`,
        );
    }
  }
  if (rules.length === 0) return;
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = rules.join("\n");
  document.documentElement.prepend(style);
}

/** Repaints a marker's mermaid arrow color. */
function paintArrow(marker: Element, color: string) {
  for (const part of [marker, ...marker.querySelectorAll("*")])
    for (const paint of ["fill", "stroke"])
      if (part.getAttribute(paint) === "var(--_arrow)")
        part.setAttribute(paint, color);
}
