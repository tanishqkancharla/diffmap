import { renderMermaidSVG } from "beautiful-mermaid";
import * as errore from "errore";
import { DiffmapMermaidError } from "./errors.js";
import { THEME_SLOTS } from "./mermaidTheme.js";

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
    try: () =>
      renderMermaidSVG(input.source, { ...THEME_SLOTS, transparent: true }),
    catch: (cause) =>
      new DiffmapMermaidError({
        path: input.path,
        where: input.where,
        reason: mermaidReason(cause),
        cause,
      }),
  });
}
