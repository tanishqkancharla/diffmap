import assert from "node:assert/strict";
import { test, after } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findDefinition, readSourceReference } from "../src/definitions.js";
import { closePythonServers } from "../src/pythonDefinitions.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "tkstack-navigation-"));
fs.writeFileSync(
  path.join(root, "helpers.py"),
  "def calculate(value):\n    return value + 1\n\nclass Base:\n    def score(self):\n        return calculate(1)\n",
);
const source =
  'from helpers import calculate as renamed, Base\n\nclass Runner(Base):\n    def run(self):\n        label = "😀"; value = renamed(2)\n        return self.score() + value\n\nclass Other:\n    def run(self):\n        return 0\n';
fs.writeFileSync(path.join(root, "main.py"), source);
fs.writeFileSync(
  path.join(root, "main.ts"),
  "function helper() { return 2; }\nconst result = helper();\n",
);
after(() => {
  closePythonServers();
  fs.rmSync(root, { recursive: true, force: true });
});
function params(file: string, line: number, word: string, text: string) {
  const lineText = text.split("\n")[line - 1]!;
  return new URLSearchParams({
    path: file,
    line: String(line),
    column: String(lineText.indexOf(word)),
    text: lineText,
  });
}
test("Python follows an imported alias, including UTF-16 positions after emoji", async () => {
  const result = await findDefinition(
    root,
    params("main.py", 5, "renamed", source),
  );
  assert.ok(result && !(result instanceof Error));
  assert.equal(result.path, "helpers.py");
  assert.equal(result.start, 1);
  assert.equal(result.end, 2);
});
test("Python follows inherited methods and highlights their body", async () => {
  const result = await findDefinition(
    root,
    params("main.py", 6, "score", source),
  );
  assert.ok(result && !(result instanceof Error));
  assert.equal(result.path, "helpers.py");
  assert.equal(result.start, 5);
  assert.equal(result.end, 6);
});
test("Python qualified symbol links resolve and ambiguous names fail clearly", async () => {
  const result = await readSourceReference(
    root,
    new URLSearchParams({ path: "main.py", symbol: "Runner.run" }),
  );
  assert.ok(result && !(result instanceof Error));
  assert.equal(result.start, 4);
  assert.equal(result.end, 6);
  const ambiguous = await readSourceReference(
    root,
    new URLSearchParams({ path: "main.py", symbol: "run" }),
  );
  assert.ok(ambiguous instanceof Error);
  assert.match(ambiguous.message, /Ambiguous/);
});
test("Reject stale diff positions and source paths outside the workspace", async () => {
  const stale = params("main.py", 5, "renamed", source);
  stale.set("text", "changed");
  assert.ok((await findDefinition(root, stale)) instanceof Error);
  assert.ok(
    (await readSourceReference(
      root,
      new URLSearchParams({ path: "../secret.py" }),
    )) instanceof Error,
  );
  fs.symlinkSync("/etc/hosts", path.join(root, "escaped.py"));
  assert.ok(
    (await readSourceReference(
      root,
      new URLSearchParams({ path: "escaped.py" }),
    )) instanceof Error,
  );
});
test("TypeScript definition navigation continues to work", async () => {
  const text = fs.readFileSync(path.join(root, "main.ts"), "utf8");
  const result = await findDefinition(
    root,
    params("main.ts", 2, "helper", text),
  );
  assert.ok(result && !(result instanceof Error));
  assert.equal(result.start, 1);
});

test("Python source links track changed documents and servers can restart", async () => {
  const file = path.join(root, "changing.py");
  fs.writeFileSync(file, "def first():\n    return 1\n");
  const read = (symbol: string) =>
    readSourceReference(
      root,
      new URLSearchParams({ path: "changing.py", symbol }),
    );
  assert.ok(!((await read("first")) instanceof Error));
  fs.writeFileSync(file, "def second():\n    return 2\n");
  const updated = await read("second");
  assert.ok(updated && !(updated instanceof Error));
  assert.match(updated.contents, /def second/);
  assert.ok((await read("first")) instanceof Error);
  closePythonServers();
  const restarted = await read("second");
  assert.ok(restarted && !(restarted instanceof Error));
});

test("Python union calls with multiple definitions report ambiguity", async () => {
  const union =
    "class A:\n    def run(self):\n        return 1\n\nclass B:\n    def run(self):\n        return 2\n\ndef call(value: A | B):\n    return value.run()\n";
  fs.writeFileSync(path.join(root, "union.py"), union);
  const result = await findDefinition(
    root,
    params("union.py", 10, "run", union),
  );
  assert.ok(result instanceof Error);
  assert.match(result.message, /multiple possible definitions/);
});
