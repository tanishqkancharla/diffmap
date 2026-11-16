import fs from "node:fs/promises";
import path from "node:path";
import { parseDiffmapConfig, type DiffmapConfig } from "./diffmapConfig.js";

export type ConfigRead =
  | { file: string; config: DiffmapConfig }
  | { file: string; error: string }
  | { file: undefined; config: DiffmapConfig };

export async function readDiffmapConfig(specDir: string): Promise<ConfigRead> {
  let dir = path.resolve(specDir);
  for (;;) {
    const file = path.join(dir, ".diffmap", "config.json");
    const text = await fs.readFile(file, "utf8").catch(() => undefined);
    if (text !== undefined) {
      try {
        return { file, config: parseDiffmapConfig(text) };
      } catch (error) {
        return {
          file,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return { file: undefined, config: {} };
    dir = parent;
  }
}
