import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseViewerDocument } from "../parseViewer.ts";
import type { ViewerNode } from "../parseViewer.ts";
import type { Fence } from "../parseFence.ts";

const homePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "home.md",
);

function collectFences(nodes: ViewerNode[]): Fence[] {
  return nodes.flatMap((node) => {
    if (node.type === "view") return [node.fence];
    if (node.type === "element") return collectFences(node.children);
    return [];
  });
}

test("homepage markdown is a real viewer document", async () => {
  const source = await fs.readFile(homePath, "utf8");
  const document = parseViewerDocument(source, "home.md");
  assert.equal(document instanceof Error, false);
  if (document instanceof Error) return;

  const fences = collectFences(document.nodes);
  const kinds = new Set(fences.map((fence) => fence.kind));
  assert.equal(kinds.has("mermaid"), true);
  assert.equal(kinds.has("callstack"), true);
  assert.equal(kinds.has("source-diff"), true);
  assert.equal(kinds.has("file"), true);
  assert.equal(kinds.has("html"), true);

  const mermaid = fences.find((fence) => fence.kind === "mermaid");
  assert.notEqual(mermaid, undefined);
  if (mermaid?.kind !== "mermaid") return;
  assert.equal(
    mermaid.annotations.some((link) =>
      link.annotation.references.some((ref) => ref.kind === "file"),
    ),
    true,
  );
  assert.equal(
    mermaid.annotations.some((link) => link.target === "edge"),
    true,
  );

  const stacks = fences.filter((fence) => fence.kind === "callstack");
  assert.equal(
    stacks.some((fence) =>
      fence.kind === "callstack"
        ? fence.lines.some((line) => line.text.startsWith("-")) &&
          fence.lines.some((line) => line.text.startsWith("+"))
        : false,
    ),
    true,
  );

  const levels = new Set(document.headings.map((heading) => heading.level));
  assert.equal(levels.has(1), true);
  assert.equal(levels.has(2), true);
  assert.equal(levels.has(3), true);
  assert.ok(document.sourceDiffs.length >= 3);
  assert.equal(document.hasReferences, true);
});
