import assert from "node:assert/strict";
import test from "node:test";
import {
  extractGistId,
  gistPath,
  gistViewerUrl,
  parseGistPath,
  parsePiGistHash,
  pickMarkdownFile,
  rewritePiGistUrl,
} from "./route.ts";

const id = "0123456789abcdef0123456789abcdef";

test("extractGistId accepts hex and gist URLs", () => {
  assert.equal(extractGistId(id), id);
  assert.equal(extractGistId(`https://gist.github.com/tanishq/${id}`), id);
  assert.equal(extractGistId(`gist.github.com/${id}`), id);
  assert.equal(extractGistId("not-a-gist"), undefined);
  assert.equal(extractGistId("abcd"), undefined);
});

test("parseGistPath reads /g/:id/:file and heading-safe home", () => {
  assert.deepEqual(parseGistPath("/"), { kind: "home" });
  assert.deepEqual(parseGistPath("/g"), { kind: "empty" });
  assert.deepEqual(parseGistPath("/g/"), { kind: "empty" });
  assert.deepEqual(parseGistPath(`/g/${id}`), {
    kind: "gist",
    gistId: id,
    file: undefined,
  });
  assert.deepEqual(parseGistPath(`/g/${id}/walkthrough.md`), {
    kind: "gist",
    gistId: id,
    file: "walkthrough.md",
  });
  assert.deepEqual(parseGistPath(`/g/${id}/nested/spec.md`), {
    kind: "gist",
    gistId: id,
    file: "nested/spec.md",
  });
  assert.equal(parseGistPath("/g/not-an-id").kind, "invalid");
  assert.deepEqual(parseGistPath(`/g/https://gist.github.com/tanishq/${id}`), {
    kind: "gist",
    gistId: id,
    file: undefined,
  });
});

test("Pi-shaped hash rewrites once to the canonical path", () => {
  assert.deepEqual(parsePiGistHash(`#${id}`), { gistId: id, file: undefined });
  assert.deepEqual(parsePiGistHash(`#${id}/README.md`), {
    gistId: id,
    file: "README.md",
  });
  assert.equal(parsePiGistHash("#implementation"), undefined);
  assert.equal(rewritePiGistUrl(`/g/${id}`, `#${id}`), undefined);
  assert.equal(rewritePiGistUrl("/g", `#${id}`), `/g/${id}`);
  assert.equal(
    rewritePiGistUrl("/g", `#${id}/spec.md&leafId=1`),
    `/g/${id}/spec.md`,
  );
});

test("pickMarkdownFile prefers README, then only md, then walkthrough/spec", () => {
  assert.equal(
    pickMarkdownFile(["notes.txt", "README.md", "a.md"], undefined),
    "README.md",
  );
  assert.equal(pickMarkdownFile(["only.md"], undefined), "only.md");
  assert.equal(
    pickMarkdownFile(["z.md", "walkthrough.md"], undefined),
    "walkthrough.md",
  );
  assert.equal(pickMarkdownFile(["b.md", "a.md"], undefined), "a.md");
  assert.equal(
    pickMarkdownFile(["README.md", "spec.md"], "spec.md"),
    "spec.md",
  );
  assert.equal(pickMarkdownFile(["README.md"], "missing.md"), undefined);
});

test("printed viewer URL keeps gist id in the path", () => {
  assert.equal(gistPath(id), `/g/${id}`);
  assert.equal(gistViewerUrl(id), `https://diffmap.dev/g/${id}`);
  assert.equal(
    gistViewerUrl(id, "Phase 1.md"),
    `https://diffmap.dev/g/${id}/Phase%201.md`,
  );
});
