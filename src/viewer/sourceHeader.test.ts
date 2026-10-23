import assert from "node:assert/strict";
import test from "node:test";
import { sourcePanelPin } from "./sourceHeader.ts";

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

test("github file pin is owner/repo @ shortsha linking to the blob at the pin SHA", () => {
  const path = "src/cli.ts";
  const pin = sourcePanelPin({
    path,
    github,
  });
  assert.deepEqual(pin, {
    kind: "github",
    label: "tanishqkancharla/diffmap @ ef78bf4",
    href: `https://github.com/tanishqkancharla/diffmap/blob/${sha}/src/cli.ts`,
  });
});

test("gist pin is gist id / filename, not a fake repo", () => {
  const pin = sourcePanelPin({
    path: "src/cli.ts",
    gist,
  });
  assert.deepEqual(pin, {
    kind: "gist",
    label: "a3d2fe2b2e0b1422a4fd5378baced900 / walkthrough.md",
    href: "https://gist.github.com/a3d2fe2b2e0b1422a4fd5378baced900",
  });
});

test("local file has no pin line", () => {
  assert.deepEqual(sourcePanelPin({ path: "src/cli.ts" }), {
    kind: "none",
  });
});
