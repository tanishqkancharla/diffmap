import assert from "node:assert/strict";
import test from "node:test";
import { shortSha } from "./shortSha.ts";

const full = "ef78bf4678d2e76a7c8bcc4087fcadf347a1fcdf";

test("shortSha keeps the first seven characters", () => {
  assert.equal(shortSha(full), "ef78bf4");
});

test("shortSha lowercases mixed-case input", () => {
  assert.equal(shortSha("EF78BF4678D2E76A"), "ef78bf4");
});

test("shortSha returns a shorter SHA unchanged aside from case", () => {
  assert.equal(shortSha("abc"), "abc");
  assert.equal(shortSha("AbC12"), "abc12");
});
