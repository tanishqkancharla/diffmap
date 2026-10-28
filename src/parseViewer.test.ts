import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { DiffmapMermaidError, DiffmapServicesError } from "./errors.js";
import { parseViewerDocument } from "./parseViewer.js";
import { serviceStateAt } from "./services.js";
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

function parseServicesSpec(body: string[]) {
  return parseViewerDocument(
    ["# Flow", "", "```services", ...body, "```", ""].join("\n"),
    "spec.md",
  );
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

test("parseViewerDocument turns prose [[path#symbol]] into a short reference", () => {
  const source =
    "See [[packages/server/src/agent/Thread.ts#Thread.attach]] here, not `[[path]]` or [x [[a.ts]]](https://x.dev).\n";
  const document = parseViewerDocument(source);
  assert.equal(document instanceof Error, false);
  if (document instanceof Error) return;
  assert.equal(document.references.length, 1);
  const paragraph = document.nodes[0];
  assert.equal(paragraph?.type, "element");
  if (paragraph?.type !== "element") return;
  assert.deepEqual(
    paragraph.children.map((node) =>
      node.type === "element"
        ? { tag: node.tag, children: node.children }
        : node,
    ),
    [
      { type: "text", value: "See " },
      {
        type: "reference",
        annotation: {
          text: "Thread.ts#Thread.attach",
          references: [
            {
              kind: "file",
              path: "packages/server/src/agent/Thread.ts",
              symbol: "Thread.attach",
            },
          ],
        },
      },
      { type: "text", value: " here, not " },
      { tag: "code", children: [{ type: "text", value: "[[path]]" }] },
      { type: "text", value: " or " },
      { tag: "a", children: [{ type: "text", value: "x [[a.ts]]" }] },
      { type: "text", value: "." },
    ],
  );
  assert.equal(
    parseViewerDocument("See [[missing:new:1]].\n") instanceof Error,
    true,
  );
});

test("parseViewerDocument reads commit references and changes fences", () => {
  const document = parseViewerDocument(
    [
      "```changes",
      "a1b2c3d..e4f5a6b",
      "```",
      "",
      "```changes",
      "```",
      "",
      "See [[a1b2c3d:src/store.ts#L12-L30]] and [[src/store.ts#L3]].",
      "",
    ].join("\n"),
  );
  assert.equal(document instanceof Error, false);
  if (document instanceof Error) return;
  assert.deepEqual(document.changeRevs, ["a1b2c3d..e4f5a6b", "working"]);
  assert.deepEqual(document.references, [
    { kind: "file", rev: "a1b2c3d", path: "src/store.ts", start: 12, end: 30 },
    { kind: "file", path: "src/store.ts", start: 3, end: 3 },
  ]);
  // A commit with a symbol, or a changes fence that is not a SHA, is an error.
  assert.equal(
    parseViewerDocument("See [[a1b2c3d:src/store.ts#save]].\n") instanceof
      Error,
    true,
  );
  assert.equal(
    parseViewerDocument("```changes\nmain\n```\n") instanceof Error,
    true,
  );
  // The removed patch fence fails instead of rendering as code.
  assert.match(
    String(
      parseViewerDocument(
        "```source-diff:store:src/store.ts\ndiff --git a/x b/x\n```\n",
      ),
    ),
    /source-diff:store:src\/store\.ts" fences were removed/,
  );
});

test("parseViewerDocument reads services, steps, and their references", () => {
  const document = parseViewerDocument(
    [
      "```services",
      "service API [[src/api.ts]]",
      "  > Routes requests.",
      "  service Auth",
      "    state attempts = 0",
      "      > Failures since the last success.",
      "      > Five locks the account.",
      "service Store",
      "  state rows = none",
      "",
      'step "Verify"',
      "  API -> Auth: verify(alice) [[src/api.ts#login]]",
      "    > Sends the password hash.",
      "  Auth.attempts = 1",
      "    > One failure so far.",
      'step "Auth stores the row"',
      "  Auth -> Store: insert",
      "  Store.rows = 1 row",
      "  Auth.attempts = 0",
      "```",
      "",
    ].join("\n"),
  );
  assert.equal(document instanceof Error, false);
  if (document instanceof Error) return;
  const fence = document.nodes[0];
  assert.equal(fence?.type === "view" && fence.fence.kind, "services");
  if (fence?.type !== "view" || fence.fence.kind !== "services") return;
  assert.equal(fence.fence.parsed.ok, true);
  if (!fence.fence.parsed.ok) return;
  const diagram = fence.fence.parsed.diagram;
  // Dedenting after Auth's state closes both Auth and API.
  assert.deepEqual(
    diagram.services.map((service) => [
      service.name,
      service.children.map((child) => child.name),
    ]),
    [
      ["API", ["Auth"]],
      ["Store", []],
    ],
  );
  // A description belongs to the line above it and joins continued lines.
  assert.equal(diagram.services[0]!.description, "Routes requests.");
  assert.equal(
    diagram.services[0]!.children[0]!.state[0]!.description,
    "Failures since the last success. Five locks the account.",
  );
  assert.equal(diagram.steps[0]!.events[0]!.note, "Sends the password hash.");
  assert.equal(diagram.steps[0]!.updates[0]!.note, "One failure so far.");
  assert.equal(diagram.steps[1]!.updates[0]!.note, undefined);
  const at = (step: number) =>
    Object.fromEntries(
      [...serviceStateAt(diagram, step)].map(([name, state]) => [
        name,
        Object.fromEntries(state),
      ]),
    );
  assert.deepEqual(at(0), {
    API: {},
    Auth: { attempts: "0" },
    Store: { rows: "none" },
  });
  assert.deepEqual(at(1), {
    API: {},
    Auth: { attempts: "1" },
    Store: { rows: "none" },
  });
  assert.deepEqual(at(2), {
    API: {},
    Auth: { attempts: "0" },
    Store: { rows: "1 row" },
  });
  assert.deepEqual(document.references, [
    { kind: "file", path: "src/api.ts" },
    { kind: "file", path: "src/api.ts", symbol: "login" },
  ]);
});

test("parseViewerDocument fails on services errors with the file line", () => {
  const unknown = parseServicesSpec([
    "service API",
    "",
    'step "Say hi"',
    "  API -> Auth: hi",
  ]);
  assert.equal(unknown instanceof DiffmapServicesError, true);
  assert.match(String(unknown), /spec\.md \(line 7\): Unknown service Auth/);
  const undeclared = parseServicesSpec([
    "service API",
    'step "Count"',
    "  API.count = 1",
  ]);
  assert.match(String(undeclared), /line 6\): API has no state count/);
  const uncaptioned = parseServicesSpec(["service API", "step"]);
  assert.match(String(uncaptioned), /line 5\): Give the step a caption/);
  const orphan = parseServicesSpec(["service API", "> Not indented."]);
  assert.match(String(orphan), /line 5\): Put a > line directly below/);
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
      workspaceRoot: packageRoot,
      filePath,
      isPublic: false,
    });
    assert.equal(shared instanceof DiffmapMermaidError, true);
    if (!(shared instanceof DiffmapMermaidError)) return;
    assert.equal(shared.path, filePath);
  });
});

test("shareMarkdownFile uploads the files excerpts and rev-less references read", async () => {
  const spec = [
    "# Shared",
    "",
    "See [[src/share.ts#shareMarkdownFile]].",
    "",
    "```1:3:src/changes.ts",
    "```",
    "",
  ].join("\n");
  await withTempSpec(spec, async (filePath) => {
    const dir = path.dirname(filePath);
    const uploaded = path.join(dir, "uploaded");
    await fs.mkdir(uploaded);
    const gh = path.join(dir, "gh");
    await fs.writeFile(
      gh,
      [
        "#!/bin/sh",
        'if [ "$1" = auth ]; then exit 0; fi',
        `for arg; do case "$arg" in *.json) cp "$arg" ${JSON.stringify(uploaded)};; esac; done`,
        "echo https://gist.github.com/0123456789abcdef0123456789abcdef",
      ].join("\n"),
      { mode: 0o755 },
    );
    const originalPath = process.env.PATH;
    process.env.PATH = `${dir}${path.delimiter}${originalPath ?? ""}`;
    try {
      const shared = await shareMarkdownFile({
        workspaceRoot: packageRoot,
        filePath,
        isPublic: false,
      });
      assert.equal(shared instanceof Error, false, String(shared));
    } finally {
      process.env.PATH = originalPath;
    }
    const files: unknown = JSON.parse(
      await fs.readFile(path.join(uploaded, "diffmap-files.json"), "utf8"),
    );
    assert.deepEqual(files, {
      "src/share.ts": await fs.readFile(
        path.join(packageRoot, "src/share.ts"),
        "utf8",
      ),
      "src/changes.ts": await fs.readFile(
        path.join(packageRoot, "src/changes.ts"),
        "utf8",
      ),
    });
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
