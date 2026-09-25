import { execFile } from "node:child_process";
import fs from "node:fs";
import { DiffmapUpdateError } from "./errors.js";

// The unscoped `diffmap` package on npm is unrelated; always use the scoped name.
export const packageName = "@tanishqkancharla/diffmap";
const latestSpec = `${packageName}@latest`;
const registryUrl =
  "https://registry.npmjs.org/@tanishqkancharla%2Fdiffmap/latest";

type InstallMethod = "npm" | "pnpm" | "bun" | "npx" | "unknown";

type Command = { command: string; args: string[] };

type UpdateResult =
  | { status: "up-to-date"; current: string; latest: string; message: string }
  | {
      status: "updated";
      previous: string;
      current: string;
      command: string;
      message: string;
    }
  | {
      status: "manual";
      current: string;
      latest: string;
      command: string;
      message: string;
    };

type UpdateDeps = {
  currentVersion: string;
  fetchLatestVersion: () => Promise<string | Error>;
  detectInstallMethod: () => Promise<InstallMethod>;
  runCommand: (command: Command) => Promise<void | Error>;
};

/** Routes `diffmap --update [...]` to the `update` command so incur's built-in updater never runs. */
export function resolveUpdateArgv(argv: string[]) {
  const separator = argv.indexOf("--");
  const flags = separator === -1 ? argv : argv.slice(0, separator);
  if (!flags.includes("--update")) return argv;
  const rest = argv.filter((token, index) => {
    return token !== "--update" || (separator !== -1 && index > separator);
  });
  return ["update", ...rest];
}

type ParsedVersion = {
  core: [number, number, number];
  prerelease: string[];
};

function parseVersion(version: string): ParsedVersion | undefined {
  const match = version
    .trim()
    .replace(/^v/, "")
    .match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return undefined;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] === undefined ? [] : match[4].split("."),
  };
}

/** Semver precedence: negative when `a < b`, positive when `a > b`, 0 when equal. */
export function compareVersions(a: string, b: string) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    return new DiffmapUpdateError({
      reason: `cannot compare versions "${a}" and "${b}"`,
    });
  }
  for (let index = 0; index < 3; index++) {
    const difference = left.core[index]! - right.core[index]!;
    if (difference !== 0) return Math.sign(difference);
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return Math.sign(right.prerelease.length - left.prerelease.length);
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index++) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      return Math.sign(Number(leftPart) - Number(rightPart));
    }
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

function normalizePath(value: string) {
  return value.replaceAll("\\", "/").replace(/\/+$/, "");
}

/** Infers the install method from the real path of the running entry script. */
function detectInstallMethodFromPath(input: {
  entryPath: string;
  env: Record<string, string | undefined>;
  npmGlobalRoot?: string | undefined;
}): InstallMethod {
  const entry = normalizePath(input.entryPath);
  if (input.env.npm_command === "exec" || entry.includes("/_npx/")) {
    return "npx";
  }
  if (entry.includes("/.bun/install/global/")) return "bun";
  const pnpmHome = input.env.PNPM_HOME;
  if (
    entry.includes("/pnpm/global/") ||
    (pnpmHome !== undefined &&
      pnpmHome !== "" &&
      entry.startsWith(`${normalizePath(pnpmHome)}/global/`))
  ) {
    return "pnpm";
  }
  if (input.npmGlobalRoot !== undefined && input.npmGlobalRoot !== "") {
    const root = normalizePath(input.npmGlobalRoot);
    if (entry.startsWith(`${root}/${packageName}/`)) return "npm";
  }
  return "unknown";
}

function globalInstallCommand(method: "npm" | "pnpm" | "bun"): Command {
  if (method === "pnpm") {
    return { command: "pnpm", args: ["add", "--global", latestSpec] };
  }
  if (method === "bun") {
    return { command: "bun", args: ["add", "--global", latestSpec] };
  }
  return { command: "npm", args: ["install", "--global", latestSpec] };
}

function formatCommand(command: Command) {
  return [command.command, ...command.args].join(" ");
}

export async function runUpdate(deps: UpdateDeps) {
  const current = deps.currentVersion;
  const latest = await deps.fetchLatestVersion();
  if (latest instanceof Error) return latest;

  const comparison = compareVersions(current, latest);
  if (comparison instanceof Error) return comparison;
  if (comparison >= 0) {
    return {
      message: `diffmap is already up to date (${current})`,
      status: "up-to-date",
      current,
      latest,
    } satisfies UpdateResult;
  }

  const method = await deps.detectInstallMethod();
  if (method === "npx") {
    const command = `npx ${latestSpec}`;
    return {
      message: `diffmap ${latest} is available (running ${current} through npx). Run \`${command}\` to use it, or install it globally with \`${formatCommand(globalInstallCommand("npm"))}\`.`,
      status: "manual",
      current,
      latest,
      command,
    } satisfies UpdateResult;
  }
  if (method === "unknown") {
    const command = formatCommand(globalInstallCommand("npm"));
    return {
      message: `diffmap ${latest} is available (running ${current}), but diffmap could not tell how it was installed. Update it with \`${command}\` or your package manager's equivalent.`,
      status: "manual",
      current,
      latest,
      command,
    } satisfies UpdateResult;
  }

  const install = globalInstallCommand(method);
  const installed = await deps.runCommand(install);
  if (installed instanceof Error) return installed;
  return {
    message: `Updated diffmap from ${current} to ${latest}`,
    status: "updated",
    previous: current,
    current: latest,
    command: formatCommand(install),
  } satisfies UpdateResult;
}

export async function fetchLatestVersion() {
  const response = await fetch(registryUrl, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  }).catch(
    (cause) =>
      new DiffmapUpdateError({
        reason: "could not reach the npm registry",
        cause,
      }),
  );
  if (response instanceof Error) return response;
  if (!response.ok) {
    return new DiffmapUpdateError({
      reason: `npm registry responded ${response.status} for ${packageName}`,
    });
  }
  const body = (await response.json().catch(() => undefined)) as
    | { version?: unknown }
    | undefined;
  if (typeof body?.version !== "string") {
    return new DiffmapUpdateError({
      reason: `npm registry returned no version for ${packageName}`,
    });
  }
  return body.version;
}

function execCommand(command: Command) {
  return new Promise<{ stdout: string; stderr: string } | Error>((resolve) => {
    execFile(
      command.command,
      command.args,
      { shell: process.platform === "win32", maxBuffer: 10_000_000 },
      (cause, stdout, stderr) => {
        if (cause) {
          const detail = stderr.trim() || stdout.trim() || cause.message;
          resolve(
            new DiffmapUpdateError({
              reason: `\`${formatCommand(command)}\` failed: ${detail}`,
              cause,
            }),
          );
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

async function readNpmGlobalRoot() {
  const result = await execCommand({
    command: "npm",
    args: ["root", "--global"],
  });
  if (result instanceof Error) return undefined;
  const root = result.stdout.trim();
  if (root === "") return undefined;
  try {
    return fs.realpathSync(root);
  } catch {
    return root;
  }
}

export async function detectInstallMethod() {
  const entry = process.argv[1];
  if (entry === undefined) return "unknown" satisfies InstallMethod;
  let entryPath = entry;
  try {
    entryPath = fs.realpathSync(entry);
  } catch {}
  const withoutNpm = detectInstallMethodFromPath({
    entryPath,
    env: process.env,
  });
  if (withoutNpm !== "unknown") return withoutNpm;
  return detectInstallMethodFromPath({
    entryPath,
    env: process.env,
    npmGlobalRoot: await readNpmGlobalRoot(),
  });
}

export async function runCommand(command: Command) {
  const result = await execCommand(command);
  if (result instanceof Error) return result;
}
