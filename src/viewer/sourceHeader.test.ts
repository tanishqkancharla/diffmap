import assert from "node:assert/strict";
import test from "node:test";
import type { CodeViewDiffItem } from "@pierre/diffs";
import {
  sourcePanelOrigin,
  sourcePanelPath,
  sourcePanelPin,
} from "./sourceHeader.ts";

const sha = "ef78bf4678d2e76a7c8bcc4087fcadf347a1fcdf";
const github = {
  owner: "tanishqkancharla",
  repo: "diffmap",
  sha,
};
const gist = {
  gistId: "a3d2fe2b2e0b1422a4fd5378baced900",
  file: "walkthrough.md",
  htmlUrl: "https://gist.github.com/a3d2fe2b2e0b1422a4fd5378baced900",
};

function diffItem(id: string, name: string): CodeViewDiffItem {
  return {
    id,
    type: "diff",
    fileDiff: { name } as CodeViewDiffItem["fileDiff"],
  };
}

test("github file pin is owner/repo @ shortsha linking to the blob at the pin SHA", () => {
  const path = "src/cli.ts";
  const pin = sourcePanelPin({
    origin: "file",
    path,
    github,
  });
  assert.deepEqual(pin, {
    kind: "github",
    label: "tanishqkancharla/diffmap @ ef78bf4",
    href: `https://github.com/tanishqkancharla/diffmap/blob/${sha}/src/cli.ts`,
  });
});

test("embedded source-diff says from this spec, not a GitHub blob", () => {
  const items = [diffItem("cli", "src/cli.ts")];
  const origin = sourcePanelOrigin({
    showingFile: false,
    reference: { kind: "file", path: "src/cli.ts" },
    items,
    linkedDiffId: "cli",
  });
  assert.equal(origin, "spec-diff");
  assert.deepEqual(sourcePanelPin({ origin, path: "src/cli.ts", github }), {
    kind: "spec",
    label: "from this spec",
  });
});

test("PR file diffs pin to the repo blob, not from this spec", () => {
  const items = [diffItem("pr:src/cli.ts", "src/cli.ts")];
  const origin = sourcePanelOrigin({
    showingFile: false,
    reference: { kind: "file", path: "src/cli.ts" },
    items,
  });
  assert.equal(origin, "repo-diff");
  const pin = sourcePanelPin({ origin, path: "src/cli.ts", github });
  assert.equal(pin.kind, "github");
  if (pin.kind !== "github") return;
  assert.equal(pin.label, "tanishqkancharla/diffmap @ ef78bf4");
  assert.match(
    pin.href,
    /\/blob\/ef78bf4678d2e76a7c8bcc4087fcadf347a1fcdf\/src\/cli.ts$/,
  );
});

test("gist pin is gist id / filename, not a fake repo", () => {
  const pin = sourcePanelPin({
    origin: "file",
    path: "src/cli.ts",
    gist,
  });
  assert.deepEqual(pin, {
    kind: "gist",
    label: "a3d2fe2b2e0b1422a4fd5378baced900 / walkthrough.md",
    href: "https://gist.github.com/a3d2fe2b2e0b1422a4fd5378baced900",
  });
});

test("gist embedded source-diff says from this spec", () => {
  const origin = sourcePanelOrigin({
    showingFile: false,
    items: [diffItem("serve", "src/serve.ts")],
    reference: { kind: "diff", id: "serve", side: "new", start: 1, end: 3 },
  });
  assert.equal(origin, "spec-diff");
  assert.deepEqual(sourcePanelPin({ origin, path: "src/serve.ts", gist }), {
    kind: "spec",
    label: "from this spec",
  });
});

test("local file has no pin line", () => {
  assert.deepEqual(sourcePanelPin({ origin: "file", path: "src/cli.ts" }), {
    kind: "none",
  });
});

test("sourcePanelPath prefers the open file, then the linked diff, then the reference", () => {
  const items = [diffItem("cli", "src/cli.ts")];
  assert.equal(
    sourcePanelPath({ filePath: "src/registry.ts", items }),
    "src/registry.ts",
  );
  assert.equal(
    sourcePanelPath({
      items,
      linkedDiffId: "cli",
      reference: { kind: "file", path: "src/other.ts" },
    }),
    "src/cli.ts",
  );
  assert.equal(
    sourcePanelPath({
      items,
      reference: { kind: "file", path: "src/cli.ts" },
    }),
    "src/cli.ts",
  );
  assert.equal(sourcePanelPath({ items: [] }), undefined);
});
