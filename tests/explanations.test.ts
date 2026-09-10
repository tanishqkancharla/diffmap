import assert from "node:assert/strict";
import { test } from "node:test";
import { parseViewerDocument } from "../src/parseViewer.js";
const explanation = {
  title: "Validate the uploaded file",
  summary: "Check that each row has the required fields.",
  steps: ["Check each row."],
  sources: ["main.py#Runner.run"],
  diagram:
    "flowchart TD\nA[Start] --> B[Result]\n%% ref edge:0 Open result [[explain:validate]]",
};
function document(detail = explanation) {
  return (
    "```mermaid\nflowchart TD\nA[Start] --> B[Result]\n%% ref edge:0 Read what happens [[explain:validate]]\n```\n\n```explain:validate\n" +
    JSON.stringify(detail) +
    "\n```"
  );
}
test("Explanation-only edge links and nested diagram links resolve with source references", () => {
  const result = parseViewerDocument(document());
  assert.ok(!(result instanceof Error));
  assert.equal(result.explanations.validate?.references[0]?.kind, "file");
  assert.equal(result.hasReferences, true);
});
test("Broken detail links and malformed explanations fail at document load", () => {
  assert.ok(
    parseViewerDocument(
      document()
        .replaceAll("explain:validate", "explain:missing")
        .replace("```explain:missing", "```explain:validate"),
    ) instanceof Error,
  );
  assert.ok(
    parseViewerDocument(
      document({ ...explanation, sources: ["invalid:::ref"] }),
    ) instanceof Error,
  );
  assert.ok(
    parseViewerDocument(
      document({
        ...explanation,
        diagram: "flowchart TD\nA --> B\n%% ref edge:0 [[explain:nope]]",
      }),
    ) instanceof Error,
  );
});

test("Legacy source-only annotations and ordinary Markdown still parse", () => {
  const result = parseViewerDocument(
    "# Existing page\n\n```callstack\nrun [[src/main.ts#run]]\n└── save [[src/store.ts#save]]\n```",
  );
  assert.ok(!(result instanceof Error));
  assert.equal(result.hasReferences, true);
  assert.deepEqual(Object.keys(result.explanations), []);
  const plain = parseViewerDocument("# Just text");
  assert.ok(!(plain instanceof Error));
  assert.equal(plain.hasReferences, false);
});

test("Reject duplicate IDs, missing related details and incorrectly typed fields", () => {
  assert.ok(parseViewerDocument(document() + document()) instanceof Error);
  for (const bad of [
    { related: ["missing"] },
    { steps: [1] },
    { summary: " " },
    { sources: ["explain:validate"] },
  ]) {
    assert.ok(
      parseViewerDocument(
        document({ ...explanation, ...bad } as typeof explanation),
      ) instanceof Error,
    );
  }
});

test("Initial detail follows document order even for numeric IDs", () => {
  const result = parseViewerDocument(
    '```explain:20\n{"title":"First","summary":"First detail"}\n```\n\n```explain:1\n{"title":"Second","summary":"Second detail"}\n```',
  );
  assert.ok(!(result instanceof Error));
  assert.equal(result.initialExplanationId, "20");
});
