/**
 * GitHub-hosted spec URLs.
 *
 * Pin model (locked): a hosted spec is always one commit SHA. The spec markdown
 * is the blob of `path` at that SHA. Every [[path]], mermaid %% ref, excerpt,
 * and hunk is loaded from that same SHA — never main / latest. A PR number only
 * chooses the SHA (head at load time, then pin). Prefer putting the SHA in the
 * URL; otherwise resolve head once per page load and use that SHA for all fetches.
 *
 * v1: /<owner>/<repo>/pull/<n>/<path-to-spec.md>
 *     /<owner>/<repo>/commit/<sha>/<path-to-spec.md>
 */
import { DIFFMAP_ORIGIN } from "../gist/route.ts";

const NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const PULL_PATTERN = /^[1-9][0-9]{0,9}$/;
const MARKDOWN_EXT = /\.(?:md|mdx)$/i;

export type GitHubRoute =
  | {
      kind: "github-pull";
      owner: string;
      repo: string;
      pull: number;
      path: string;
    }
  | {
      kind: "github-commit";
      owner: string;
      repo: string;
      sha: string;
      path: string;
    }
  | { kind: "github-invalid"; message: string };

export function parseGitHubPath(
  pathname: string,
): GitHubRoute | { kind: "home" } {
  const parts = normalizePath(pathname)
    .split("/")
    .filter((part) => part.length > 0);
  if (parts.length < 4) return { kind: "home" };
  const owner = decodePathSegment(parts[0] ?? "");
  const repo = decodePathSegment(parts[1] ?? "");
  const kind = parts[2];
  const id = decodePathSegment(parts[3] ?? "");
  if (!isRepoName(owner) || !isRepoName(repo)) return { kind: "home" };
  if (kind !== "pull" && kind !== "commit") return { kind: "home" };

  const specPath = parts.slice(4).map(decodePathSegment).join("/");
  if (kind === "pull") {
    if (!PULL_PATTERN.test(id)) {
      return { kind: "github-invalid", message: "Not a pull request number." };
    }
    const pathError = specPathError(specPath);
    if (pathError !== undefined)
      return { kind: "github-invalid", message: pathError };
    return {
      kind: "github-pull",
      owner,
      repo,
      pull: Number(id),
      path: specPath,
    };
  }
  if (!SHA_PATTERN.test(id)) {
    return { kind: "github-invalid", message: "Not a git commit SHA." };
  }
  const pathError = specPathError(specPath);
  if (pathError !== undefined)
    return { kind: "github-invalid", message: pathError };
  return {
    kind: "github-commit",
    owner,
    repo,
    sha: id.toLowerCase(),
    path: specPath,
  };
}

export function githubPullPath(
  owner: string,
  repo: string,
  pull: number,
  filePath: string,
) {
  return `/${encodeName(owner)}/${encodeName(repo)}/pull/${String(pull)}/${encodeSpecPath(filePath)}`;
}

export function githubCommitPath(
  owner: string,
  repo: string,
  sha: string,
  filePath: string,
) {
  return `/${encodeName(owner)}/${encodeName(repo)}/commit/${sha}/${encodeSpecPath(filePath)}`;
}

export function githubViewerUrl(
  owner: string,
  repo: string,
  pin: { pull: number } | { sha: string },
  filePath: string,
  origin = DIFFMAP_ORIGIN,
) {
  const path =
    "pull" in pin
      ? githubPullPath(owner, repo, pin.pull, filePath)
      : githubCommitPath(owner, repo, pin.sha, filePath);
  return `${origin}${path}`;
}

export function githubBlobUrl(
  owner: string,
  repo: string,
  sha: string,
  filePath: string,
) {
  return `https://github.com/${owner}/${repo}/blob/${sha}/${filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function githubPullUrl(owner: string, repo: string, pull: number) {
  return `https://github.com/${owner}/${repo}/pull/${String(pull)}`;
}

function isRepoName(value: string) {
  return (
    NAME_PATTERN.test(value) &&
    value !== "." &&
    value !== ".." &&
    !value.startsWith(".")
  );
}

function specPathError(specPath: string) {
  if (specPath.length === 0) {
    return "A hosted spec URL needs a markdown path after the pull or commit.";
  }
  if (specPath.split("/").some((part) => part === "." || part === "..")) {
    return "Spec path is not a repository file.";
  }
  if (!MARKDOWN_EXT.test(specPath)) {
    return "Spec path must be a .md or .mdx file.";
  }
  return undefined;
}

function encodeName(value: string) {
  return encodeURIComponent(value);
}

function encodeSpecPath(filePath: string) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function normalizePath(pathname: string) {
  if (pathname.length === 0) return "/";
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
