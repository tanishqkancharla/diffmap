import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import os from "node:os";
import * as path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));

function fixture(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "semvariant-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file: string, content: string) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  git("init", "--quiet");
  git("config", "user.name", "Semvariant test");
  git("config", "user.email", "semvariant@example.invalid");
  git("config", "commit.gpgsign", "false");
  write("package.json", '{"type":"module"}\n');
  write(".gitignore", "node_modules/\n");
  for (const file of ["cli.ts", "semvariant.ts"]) {
    write(
      `tools/semvariant/${file}`,
      fs.readFileSync(path.join(sourceRoot, "tools/semvariant", file), "utf8"),
    );
  }
  fs.symlinkSync(
    path.join(sourceRoot, "node_modules"),
    path.join(root, "node_modules"),
    "dir",
  );
  for (const dir of ["src/viewer/deep", "src/parser", "unrelated"]) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  const rule = (id: string, guides: string[], title: string, body: string) =>
    write(
      `tools/semvariant/rules/${id}.md`,
      `---\nguides: ${JSON.stringify(guides)}\n---\n\n# ${title}\n\n${body}\n`,
    );
  rule("R0001", ["."], "Root rule.", "Root rationale: preserve approval.");
  rule(
    "R0002",
    ["src/viewer"],
    "Viewer rule.",
    "Viewer rationale: accessible controls.",
  );
  rule(
    "R0003",
    ["src/parser"],
    "Parser rule.",
    "Parser rationale: reject invalid input.",
  );
  const run = (args: string[], status: number) => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "tools/semvariant/cli.ts", ...args],
      {
        cwd: root,
        encoding: "utf8",
      },
    );
    const output = result.stdout + result.stderr;
    assert.equal(result.status, status, output);
    return output;
  };
  return {
    root,
    write,
    read,
    rule,
    git,
    ok: (...args: string[]) => run(args, 0),
    fail: (...args: string[]) => run(args, 1),
  };
}

test("CLI retrieves ancestor rules once, with full bodies only on request", (t) => {
  const f = fixture(t);
  f.ok("generate");
  const context = f.ok(
    "context",
    "src/viewer/deep/new.ts",
    "src/viewer/other.ts",
  );
  assert.deepEqual(
    [...context.matchAll(/^- (R\d{4}):/gm)].map((m) => m[1]),
    ["R0001", "R0002"],
  );
  assert.doesNotMatch(context, /rationale/);
  assert.match(
    f.ok("context", "src/viewer/new.ts", "--full"),
    /Viewer rationale: accessible controls/,
  );
  assert.doesNotMatch(f.ok("context", "src"), /R0002|R0003/);
  assert.doesNotMatch(f.ok("context", "src/parser/new.ts"), /R0002/);
  assert.match(
    f.ok("show", "r0002", "R0001"),
    /Root rationale: preserve approval/,
  );
  assert.equal(f.ok("show", "R9999").trim(), "No matching rules.");
  assert.deepEqual(
    f.ok("search", "ACCESSIBLE", "reject invalid").trim().split("\n"),
    ["R0002 — Viewer rule.", "R0003 — Parser rule."],
  );
  assert.equal(f.ok("search", "not-present").trim(), "No matching rules.");
});

test("CLI detects drift, repairs missing/changed guides, and removes only stale owned guides", (t) => {
  const f = fixture(t);
  assert.match(f.fail("check"), /missing: AGENTS.md/);
  f.ok("generate");
  const original = f.read("AGENTS.md");
  assert.match(original, /npm run semvariant -- context <paths>/);
  assert.match(original, /Semvariant stores repository guidance/);
  const scoped = f.read("src/viewer/AGENTS.md");
  assert.doesNotMatch(scoped, /Semvariant stores|Before editing or reviewing/);
  assert.match(scoped, /- R0002: Viewer rule\./);
  assert.match(f.ok("generate"), /up to date/);
  assert.equal(f.read("AGENTS.md"), original);
  f.write("AGENTS.md", original.replace("Root rule.", "Wrong rule."));
  assert.match(f.fail("check"), /changed: AGENTS.md/);
  assert.match(f.fail("context", "src/viewer/new.ts"), /changed: AGENTS.md/);
  f.ok("generate");
  assert.equal(f.read("AGENTS.md"), original);
  fs.rmSync(path.join(f.root, "src/parser/AGENTS.md"));
  f.ok("generate");
  assert.match(f.read("src/parser/AGENTS.md"), /Parser rule/);
  const viewerGuide = f.read("src/viewer/AGENTS.md");
  f.write("unrelated/AGENTS.md", "# Authored unrelated guide\n");
  fs.rmSync(path.join(f.root, "tools/semvariant/rules/R0002.md"));
  assert.match(f.fail("check"), /stale: src\/viewer\/AGENTS.md/);
  assert.match(f.ok("generate"), /deleted: src\/viewer\/AGENTS.md/);
  assert.equal(fs.existsSync(path.join(f.root, "src/viewer/AGENTS.md")), false);
  assert.equal(f.read("unrelated/AGENTS.md"), "# Authored unrelated guide\n");
  f.write("unrelated/.gitignore", "ignored/\n");
  f.write("unrelated/ignored/AGENTS.md", viewerGuide);
  f.write("unrelated/nested/AGENTS.md", viewerGuide);
  execFileSync("git", ["init", "--quiet", "unrelated/nested"], { cwd: f.root });
  f.ok("generate");
  assert.equal(f.read("unrelated/ignored/AGENTS.md"), viewerGuide);
  assert.equal(f.read("unrelated/nested/AGENTS.md"), viewerGuide);
});

test("CLI refuses authored targets without modifying any guide", (t) => {
  const f = fixture(t);
  const authored = "# Keep my authored guide\n";
  f.write("AGENTS.md", authored);
  assert.match(f.fail("generate"), /Refusing to overwrite authored guides/);
  assert.equal(f.read("AGENTS.md"), authored);
  assert.equal(fs.existsSync(path.join(f.root, "src/viewer/AGENTS.md")), false);
});

test("CLI accepts CRLF, block/inline scopes and fenced H1 examples", (t) => {
  const f = fixture(t);
  f.write(
    "tools/semvariant/rules/R0002.md",
    [
      "---",
      "guides:",
      "  - src/viewer",
      "---",
      "# Viewer rule.",
      "```md",
      "# Example, not another title",
      "```",
      "~~~md",
      "# Also an example",
      "~~~",
      "",
    ].join("\r\n"),
  );
  f.ok("generate");
  f.write("AGENTS.md", f.read("AGENTS.md").replaceAll("\n", "\r\n"));
  assert.match(f.ok("check"), /valid/);
  assert.match(
    f.ok("context", "src/viewer/new.ts", "--full"),
    /Example, not another title/,
  );
});

test("CLI rejects malformed records instead of generating guidance", (t) => {
  const f = fixture(t);
  f.ok("generate");
  const original = f.read("AGENTS.md");
  for (const [content, error] of [
    ["# Missing frontmatter", /missing frontmatter/],
    ["---\nguides: []\n---\n# Empty scopes", /distinct repository directories/],
    [
      '---\nguides: [".", "."]\n---\n# Duplicate scope',
      /distinct repository directories/,
    ],
    [
      '---\nguides: ["."]\nextra: value\n---\n# Extra field',
      /only one guides field/,
    ],
    ['---\nguides: ["."]\n---\n# First\n# Second', /exactly one nonempty H1/],
    ['---\nguides: ["."]\n---\n# ', /exactly one nonempty H1/],
  ] as const) {
    f.write("tools/semvariant/rules/R0009.md", content);
    assert.match(f.fail("generate"), error);
    assert.equal(f.read("AGENTS.md"), original);
  }
  fs.rmSync(path.join(f.root, "tools/semvariant/rules/R0009.md"));
  f.write(
    "tools/semvariant/rules/not-a-rule.md",
    '---\nguides: ["."]\n---\n# Valid title\n',
  );
  assert.match(f.fail("check"), /filename must be RNNNN.md/);
});

test("CLI rejects unsafe scopes, symlink escapes and option-like revisions", (t) => {
  const f = fixture(t);
  f.ok("generate");
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "semvariant-outside-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, path.join(f.root, "escape"), "dir");
  for (const scope of [
    "../outside",
    outside,
    "src/../viewer",
    "missing",
    "escape",
    "node_modules",
    "data",
    ".git",
  ]) {
    f.rule("R0009", [scope], "Unsafe scope.", "Must not write.");
    assert.match(
      f.fail("generate"),
      /invalid guide|does not exist|symlink guide|excluded guide/,
    );
    assert.deepEqual(fs.readdirSync(outside), []);
  }
  fs.rmSync(path.join(f.root, "tools/semvariant/rules/R0009.md"));
  assert.match(f.fail("context", outside), /outside repository/);
  assert.match(f.fail("context", "escape/new.ts"), /outside repository/);
  assert.match(f.fail("context", "--diff", "--help"), /option-like/);
});

test("CLI selects staged deletion and both rename scopes, but not untracked paths", (t) => {
  const f = fixture(t);
  f.ok("generate");
  f.write("src/viewer/move.ts", "export const value = 123;\n");
  f.write("src/viewer/delete.ts", "export const removed = 456;\n");
  f.git("add", ".");
  f.git("commit", "--quiet", "-m", "Fixture baseline");
  f.git("mv", "src/viewer/move.ts", "src/parser/move.ts");
  f.git("rm", "--quiet", "src/viewer/delete.ts");
  f.write("unrelated/untracked.ts", "export const untracked = true;\n");
  const staged = f.ok("context", "--staged");
  assert.match(staged, /- src\/viewer\/move.ts\n/);
  assert.match(staged, /- src\/parser\/move.ts\n/);
  assert.match(staged, /- src\/viewer\/delete.ts\n/);
  assert.match(staged, /R0002: Viewer rule/);
  assert.match(staged, /R0003: Parser rule/);
  assert.doesNotMatch(staged, /untracked.ts/);
  assert.match(
    f.ok("context", "unrelated/untracked.ts"),
    /- unrelated\/untracked.ts/,
  );
  assert.equal(f.ok("context", "--diff", "HEAD"), staged);
});
