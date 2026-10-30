import assert from "node:assert/strict";
import test from "node:test";
import { formatComments } from "./comments.ts";

test("copied comments name file lines, quote the text, and keep code fences intact", () => {
  const markdown = formatComments({
    title: "Walkthrough",
    source: "specs/walkthrough.md",
    comments: [
      {
        id: "a",
        body: "Say which version.\nOr drop it.",
        anchor: {
          kind: "text",
          quote: "with md4x",
          prefix: "",
          suffix: "",
          offset: 0,
          display: "with md4x",
          section: "Parsing",
        },
      },
      {
        id: "b",
        body: "Group these.",
        anchor: {
          kind: "lines",
          target: "excerpt:src/a.ts#20-30",
          path: "src/a.ts",
          side: undefined,
          start: 2,
          end: 3,
          // An excerpt from line 20 shows its first line as 1.
          lineOffset: 19,
          lines: ["const a = `x`;", "const b = ```y```;"],
          context: "file excerpt in the document",
        },
      },
      {
        id: "c",
        body: "Why remove this?",
        anchor: {
          kind: "lines",
          target: "panel:working",
          path: "README.md",
          side: "deletions",
          start: 7,
          end: 7,
          lineOffset: 0,
          lines: ["old line"],
          context: "Diff panel: Uncommitted",
        },
      },
    ],
  });
  assert.equal(
    markdown,
    `Review comments on "Walkthrough" (specs/walkthrough.md):

1. In "Parsing":
   > with md4x

   Say which version.
   Or drop it.

2. src/a.ts:21-22 (file excerpt in the document):
   \`\`\`\`ts
   const a = \`x\`;
   const b = \`\`\`y\`\`\`;
   \`\`\`\`

   Group these.

3. README.md:7 (Diff panel: Uncommitted, removed lines):
   \`\`\`md
   old line
   \`\`\`

   Why remove this?
`,
  );
});
