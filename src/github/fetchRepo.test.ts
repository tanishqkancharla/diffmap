import assert from "node:assert/strict";
import test from "node:test";
import { findSymbolLineRange } from "./fetchRepo.ts";

test("findSymbolLineRange highlights a function declaration", () => {
  const source = ["const x = 1;", "export function startServer() {", "}"].join(
    "\n",
  );
  assert.deepEqual(findSymbolLineRange(source, "startServer"), {
    start: 2,
    end: 2,
  });
  assert.deepEqual(findSymbolLineRange(source, "Serve.startServer"), {
    start: 2,
    end: 2,
  });
});
