import { parseAnnotation, type SourceReference } from "./annotations.js";
import {
  parseDiagramAnnotations,
  type DiagramAnnotation,
} from "./diagramAnnotations.js";

export type Explanation = {
  id: string;
  title: string;
  summary: string;
  why?: string;
  steps: string[];
  example?: string;
  inputs?: string;
  outputs?: string;
  caveat?: string;
  diagram?: string;
  annotations: DiagramAnnotation[];
  related: string[];
  references: SourceReference[];
};

export function parseExplanation(id: string, source: string): Explanation {
  const value: unknown = JSON.parse(source);
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`Explanation ${id} must be an object.`);
  const data = value as Record<string, unknown>;
  for (const key of ["title", "summary"])
    if (typeof data[key] !== "string" || !data[key].trim())
      throw new Error(`Explanation ${id} needs a ${key}.`);
  for (const key of [
    "why",
    "example",
    "inputs",
    "outputs",
    "caveat",
    "diagram",
  ])
    if (data[key] !== undefined && typeof data[key] !== "string")
      throw new Error(`Explanation ${id}: ${key} must be text.`);
  for (const key of ["steps", "related", "sources"])
    if (
      data[key] !== undefined &&
      (!Array.isArray(data[key]) ||
        !data[key].every((item: unknown) => typeof item === "string"))
    )
      throw new Error(`Explanation ${id}: ${key} must be an array of strings.`);
  const references = ((data.sources ?? []) as string[]).flatMap((sourceRef) => {
    const parsed = parseAnnotation(`[[${sourceRef}]]`);
    if (
      parsed.references.length !== 1 ||
      parsed.explanationId ||
      parsed.text.trim()
    )
      throw new Error(`Explanation ${id}: invalid source ${sourceRef}.`);
    return parsed.references;
  });
  return {
    id,
    title: data.title as string,
    summary: data.summary as string,
    why: data.why as string | undefined,
    example: data.example as string | undefined,
    inputs: data.inputs as string | undefined,
    outputs: data.outputs as string | undefined,
    caveat: data.caveat as string | undefined,
    diagram: data.diagram as string | undefined,
    steps: (data.steps ?? []) as string[],
    related: (data.related ?? []) as string[],
    references,
    annotations: parseDiagramAnnotations((data.diagram ?? "") as string),
  };
}
