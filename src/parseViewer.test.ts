import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { DiffmapMermaidError } from "./errors.js";
import { parseViewerDocument } from "./parseViewer.js";
import { shareMarkdownFile } from "./share.js";
import { startServer } from "./serve.js";

const execFileAsync = promisify(execFile);
const srcDir = fileURLToPath(new URL(".", import.meta.url));
const packageRoot = path.resolve(srcDir, "..");
const cliPath = path.join(srcDir, "cli.ts");
const sampleSpec = path.join(packageRoot, "fixtures", "sample-spec.md");

function brokenMermaidSpec(body = "flwochart TD\n  A --> B") {
  return `# Broken mermaid\n\n\`\`\`mermaid\n${body}\n\`\`\`\n`;
}

async function withTempSpec(
  source: string,
  run: (filePath: string) => Promise<void>,
) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-mermaid-"));
  const filePath = path.join(dir, "broken.md");
  await fs.writeFile(filePath, source);
  try {
    await run(filePath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function runCli(args: string[]) {
  try {
    const result = await execFileAsync(
      process.execPath,
      ["--import", "tsx", cliPath, ...args],
      {
        cwd: packageRoot,
        timeout: 20_000,
        maxBuffer: 1_000_000,
      },
    );
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (cause) {
    if (typeof cause !== "object" || !cause) throw cause;
    const exitCode =
      "code" in cause && typeof cause.code === "number"
        ? cause.code
        : undefined;
    const stdout =
      "stdout" in cause && typeof cause.stdout === "string" ? cause.stdout : "";
    const stderr =
      "stderr" in cause && typeof cause.stderr === "string" ? cause.stderr : "";
    return { exitCode, stdout, stderr };
  }
}

test("parseViewerDocument accepts a spec with valid mermaid", async () => {
  const source = await fs.readFile(sampleSpec, "utf8");
  const document = parseViewerDocument(source, sampleSpec);
  assert.equal(document instanceof Error, false);
  if (document instanceof Error) return;
  assert.equal(
    document.nodes.some(
      (node) => node.type === "view" && node.fence.kind === "mermaid",
    ),
    true,
  );
});

test("parseViewerDocument fails on broken mermaid with file and diagram", () => {
  const source = brokenMermaidSpec();
  const parsed = parseViewerDocument(source, "broken.md");
  assert.equal(parsed instanceof DiffmapMermaidError, true);
  if (!(parsed instanceof DiffmapMermaidError)) return;
  assert.equal(parsed.path, "broken.md");
  assert.equal(parsed.where, "diagram 1, line 3");
  assert.match(String(parsed.reason), /Invalid mermaid header: "flwochart TD"/);
  assert.equal(
    parsed.message,
    'diffmap could not parse mermaid in broken.md (diagram 1, line 3): Invalid mermaid header: "flwochart TD". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.',
  );
});

test("parseViewerDocument names the second mermaid diagram when it is invalid", () => {
  const source = `# Two diagrams

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`

\`\`\`mermaid
not a diagram
\`\`\`
`;
  const parsed = parseViewerDocument(source, "two.md");
  assert.equal(parsed instanceof DiffmapMermaidError, true);
  if (!(parsed instanceof DiffmapMermaidError)) return;
  assert.equal(parsed.where, "diagram 2, line 8");
  assert.match(parsed.message, /in two\.md \(diagram 2, line 8\)/);
});

test("parseViewerDocument fails on invalid MDC mermaid", () => {
  const source = `# MDC

::mermaid
flwochart TD
A --> B
::
`;
  const parsed = parseViewerDocument(source, "mdc.md");
  assert.equal(parsed instanceof DiffmapMermaidError, true);
  if (!(parsed instanceof DiffmapMermaidError)) return;
  assert.equal(parsed.where, "diagram 1, line 3");
});

test("startServer does not listen when mermaid is invalid", async () => {
  await withTempSpec(brokenMermaidSpec(), async (filePath) => {
    const started = await startServer({
      filePath,
      workspaceRoot: path.dirname(filePath),
      port: 0,
    });
    assert.equal(started instanceof DiffmapMermaidError, true);
    if (!(started instanceof DiffmapMermaidError)) return;
    assert.equal(started.path, filePath);
    assert.equal(started.where, "diagram 1, line 3");
  });
});

test("shareMarkdownFile does not call gh when mermaid is invalid", async () => {
  await withTempSpec(brokenMermaidSpec(), async (filePath) => {
    const shared = await shareMarkdownFile({
      filePath,
      isPublic: false,
    });
    assert.equal(shared instanceof DiffmapMermaidError, true);
    if (!(shared instanceof DiffmapMermaidError)) return;
    assert.equal(shared.path, filePath);
  });
});

function mermaidCliMessage(filePath: string) {
  return `diffmap could not parse mermaid in ${filePath} (diagram 1, line 3): Invalid mermaid header: "flwochart TD". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.`;
}

test("diffmap serve exits non-zero on broken mermaid", async () => {
  await withTempSpec(brokenMermaidSpec(), async (filePath) => {
    const result = await runCli(["serve", filePath]);
    assert.equal(result.exitCode, 1);
    assert.equal(
      `${result.stdout}${result.stderr}`,
      `Error (DIFFMAP): ${mermaidCliMessage(filePath)}\n`,
    );
  });
});

test("bare diffmap <file.md> exits non-zero on broken mermaid", async () => {
  await withTempSpec(brokenMermaidSpec(), async (filePath) => {
    const result = await runCli([filePath]);
    assert.equal(result.exitCode, 1);
    assert.equal(
      `${result.stdout}${result.stderr}`,
      `Error (DIFFMAP): ${mermaidCliMessage(filePath)}\n`,
    );
  });
});

test("diffmap share exits non-zero on broken mermaid", async () => {
  await withTempSpec(brokenMermaidSpec(), async (filePath) => {
    const result = await runCli(["share", filePath]);
    assert.equal(result.exitCode, 1);
    assert.equal(
      `${result.stdout}${result.stderr}`.trimEnd(),
      `code: DIFFMAP\nmessage: ${JSON.stringify(mermaidCliMessage(filePath))}`,
    );
  });
});
