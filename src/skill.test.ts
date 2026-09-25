import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { installSkill, skillTargetDir } from "./skill.js";

test("installSkill installs, reports current, then refreshes on a new version", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-skill-"));
  const targetDir = skillTargetDir(root);
  try {
    const first = await installSkill({ targetDir, version: "0.1.0" });
    assert.ok(!(first instanceof Error));
    assert.equal(first.status, "installed");
    await fs.access(path.join(targetDir, "SKILL.md"));

    const again = await installSkill({ targetDir, version: "0.1.0" });
    assert.ok(!(again instanceof Error));
    assert.equal(again.status, "current");

    const next = await installSkill({ targetDir, version: "0.2.0" });
    assert.ok(!(next instanceof Error));
    assert.equal(next.status, "updated");
    assert.equal(
      (
        await fs.readFile(path.join(targetDir, ".diffmap-version"), "utf8")
      ).trim(),
      "0.2.0",
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
