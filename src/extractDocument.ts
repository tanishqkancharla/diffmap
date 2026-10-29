import { parseFence, type Fence } from "./parseFence.js";

const fencePattern = /^```([^\n]*)\r?\n([\s\S]*?)^```/gm;
const titlePattern = /^#\s+(.+)$/m;

export function extractTitle(source: string) {
  const match = titlePattern.exec(source);
  if (match?.[1] === undefined) return "diffmap";
  return match[1];
}

export function extractFences(source: string) {
  const fences: Fence[] = [];
  for (const match of source.matchAll(fencePattern)) {
    const lang = (match[1] ?? "").trim();
    const body = match[2] ?? "";
    // A diagram's info string can add `diff`, and Mermaid a [Title].
    const diagram = /^(mermaid|services)\b\s*(diff)?\s*(?:\[([^\]]*)\])?$/.exec(
      lang,
    );
    fences.push(
      diagram === null
        ? parseFence(lang, body)
        : parseFence(diagram[1]!, body, [], diagram[3], diagram[2]),
    );
  }
  return fences;
}
