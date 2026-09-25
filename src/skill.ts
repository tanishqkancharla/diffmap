import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DiffmapSkillError } from "./errors.js";

export const skillName = "generate-spec";
const versionFile = ".diffmap-version";
const packagedSkillDir = fileURLToPath(
  new URL(`../skills/${skillName}/`, import.meta.url),
);

/** Same layout `npx skills add` uses: `<root>/.agents/skills/<name>`. */
export function skillTargetDir(root: string) {
  return path.join(root, ".agents", "skills", skillName);
}

async function readInstalledVersion(targetDir: string) {
  const [marker, skill] = await Promise.all([
    fs
      .readFile(path.join(targetDir, versionFile), "utf8")
      .catch(() => undefined),
    fs.stat(path.join(targetDir, "SKILL.md")).catch(() => undefined),
  ]);
  if (skill === undefined) return { exists: false as const };
  return { exists: true as const, version: marker?.trim() };
}

export async function installSkill(input: {
  targetDir: string;
  version: string;
  sourceDir?: string;
}) {
  const sourceDir = input.sourceDir ?? packagedSkillDir;
  const installed = await readInstalledVersion(input.targetDir);
  if (installed.exists && installed.version === input.version) {
    return {
      message: `${skillName} skill is already current (${input.version})`,
      status: "current" as const,
      path: input.targetDir,
      version: input.version,
    };
  }

  const copied = await fs
    .rm(input.targetDir, { recursive: true, force: true })
    .then(() => fs.cp(sourceDir, input.targetDir, { recursive: true }))
    .then(() =>
      fs.writeFile(
        path.join(input.targetDir, versionFile),
        `${input.version}\n`,
      ),
    )
    .catch(
      (cause) =>
        new DiffmapSkillError({ reason: `copy to ${input.targetDir}`, cause }),
    );
  if (copied instanceof Error) return copied;

  if (!installed.exists) {
    return {
      message: `Installed ${skillName} skill (${input.version})`,
      status: "installed" as const,
      path: input.targetDir,
      version: input.version,
    };
  }
  const previous = installed.version ?? "unknown";
  return {
    message: `Updated ${skillName} skill from ${previous} to ${input.version}`,
    status: "updated" as const,
    path: input.targetDir,
    version: input.version,
    previous,
  };
}
