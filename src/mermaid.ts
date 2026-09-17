import { renderMermaidSVG } from "beautiful-mermaid";
import * as errore from "errore";
import { DiffmapMermaidError } from "./errors.js";

function mermaidReason(cause: unknown) {
  if (cause instanceof Error && cause.message !== "") return cause.message;
  return "unknown error";
}

export function parseMermaidDiagram(input: {
  source: string;
  path: string;
  where: string;
}) {
  return errore.try({
    try: () => renderMermaidSVG(input.source),
    catch: (cause) =>
      new DiffmapMermaidError({
        path: input.path,
        where: input.where,
        reason: mermaidReason(cause),
        cause,
      }),
  });
}

export function mermaidSvg(input: {
  source: string;
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  surface: string;
  border: string;
  font: string;
}) {
  return errore.try({
    try: () =>
      renderMermaidSVG(input.source, {
        bg: input.bg,
        fg: input.fg,
        accent: input.accent,
        muted: input.muted,
        surface: input.surface,
        border: input.border,
        font: input.font,
        transparent: true,
      }),
    catch: (cause) =>
      new DiffmapMermaidError({
        path: "spec",
        where: "diagram 1",
        reason: mermaidReason(cause),
        cause,
      }),
  });
}
