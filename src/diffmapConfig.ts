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

/** What the viewer gets for the spec it shows: the config, or why it can't be read. */
export type ConfigLoad = { config: DiffmapConfig } | { error: string };

/** The `.diffmap/config.json` paths that apply to a spec in `specDir`, nearest first, relative to the same root. */
export function configCandidates(specDir: string) {
  const parts = specDir.split("/").filter((part) => part !== "");
  return parts
    .map((_, index) => parts.slice(0, parts.length - index).join("/"))
    .concat("")
    .map((dir) => (dir === "" ? "" : `${dir}/`) + ".diffmap/config.json");
}

export function parseDiffmapConfig(text: string): DiffmapConfig {
  return checkConfig(JSON.parse(text) as unknown);
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

/** The pull request a spec on diffmap.dev was opened from, which fills `previews.preview`. */
export type DeploymentTarget = {
  sha: string;
  /** The pull request's head branch. */
  branch?: string;
  pull?: number;
};

/**
 * `previews.preview` with its placeholders filled. `{branch}` is the branch
 * name as Vercel and Netlify put it in a hostname: lowercase, with every run of
 * characters other than letters and digits turned into `-`.
 */
export function deploymentUrl(
  template: string,
  target: DeploymentTarget,
): string | Error {
  const values: Record<string, string | undefined> = {
    sha: target.sha,
    branch:
      target.branch === undefined
        ? undefined
        : target.branch
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
    pull: target.pull === undefined ? undefined : String(target.pull),
  };
  const missing = new Set<string>();
  const url = template.replace(/\{(sha|branch|pull)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) {
      missing.add(name);
      return "";
    }
    return encodeURIComponent(value);
  });
  if (missing.size > 0)
    return new Error(
      `previews.preview needs ${[...missing].map((name) => `{${name}}`).join(" and ")}, which come from the pull request.`,
    );
  return url;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
