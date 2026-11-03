/**
 * Stand-ins for the viewer's theme, which only the browser knows. Diagrams are
 * drawn once, while the spec is parsed, and themeMermaidSvg swaps in the real
 * values; beautiful-mermaid lays a diagram out the same for any of them.
 */
export const THEME_SLOTS = {
  bg: "var(--diffmap-mermaid-bg)",
  fg: "var(--diffmap-mermaid-fg)",
  accent: "var(--diffmap-mermaid-accent)",
  muted: "var(--diffmap-mermaid-muted)",
  surface: "var(--diffmap-mermaid-surface)",
  border: "var(--diffmap-mermaid-border)",
  // Spaces make its URL-encoded form, in the font import, differ from the plain one.
  font: "diffmap mermaid font",
};

export type MermaidTheme = Record<keyof typeof THEME_SLOTS, string>;

/** A diagram from parseMermaidDiagram, in the viewer's colors and font. */
export function themeMermaidSvg(svg: string, theme: MermaidTheme) {
  // The theme sits in the root element and its first stylesheet; labels, which could quote a slot, come after.
  const end = svg.indexOf("</style>");
  let head = svg.slice(0, end);
  for (const [key, slot] of Object.entries(THEME_SLOTS)) {
    const value = theme[key as keyof MermaidTheme];
    head = head
      .replaceAll(encodeURIComponent(slot), encodeURIComponent(value))
      .replaceAll(slot, value);
  }
  return head + svg.slice(end);
}
