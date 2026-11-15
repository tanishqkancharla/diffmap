import fs from "node:fs/promises";
import path from "node:path";

/** `.diffmap/config.json`: diffmap's one config file, found in the spec's directory or a parent of it. */
export type DiffmapConfig = {
  /** Where the app's preview page lives; preview and flow blocks load it. */
  previews?: {
    local?: string;
    /** A pull request's preview deployment, with {branch}, {sha}, and {pull}. */
    preview?: string;
  };
  /** Settings only flow blocks use. */
  flows?: {
    /** "play" plays a step on the live UI; "render" draws each state from the start. */
    transitions?: "play" | "render";
    /** The size the expanded flow renders the app at. */
    viewport?: { width: number; height: number };
  };
};

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
        return { file, config: checkConfig(JSON.parse(text) as unknown) };
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

function checkConfig(value: unknown): DiffmapConfig {
  if (!isObject(value)) throw new Error("the file is not a JSON object");
  const { previews, flows } = value;
  if (previews !== undefined) {
    if (!isObject(previews))
      throw new Error("previews is an object with local and preview URLs");
    for (const key of ["local", "preview"] as const)
      if (previews[key] !== undefined && typeof previews[key] !== "string")
        throw new Error(`previews.${key} is a URL string`);
  }
  if (flows !== undefined) {
    if (!isObject(flows)) throw new Error("flows is an object of settings");
    if (
      flows.transitions !== undefined &&
      flows.transitions !== "play" &&
      flows.transitions !== "render"
    )
      throw new Error('flows.transitions is "play" or "render"');
    const viewport = flows.viewport;
    if (
      viewport !== undefined &&
      !(
        isObject(viewport) &&
        typeof viewport.width === "number" &&
        typeof viewport.height === "number"
      )
    )
      throw new Error("flows.viewport is { width, height } in pixels");
  }
  // SAFETY: checked field by field above.
  return value as DiffmapConfig;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
