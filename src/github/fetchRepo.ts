/**
 * Pin model (locked): fetch the spec and every referenced file from one commit
 * SHA. A PR number is only used to choose that SHA (head at load time). Never
 * fetch `ref=main` / latest for spec markdown, [[path]] targets, excerpts, or
 * hunks. Private repos are out of scope (GitHub 404).
 */
import { WORKING, type Changes, type Rev } from "../changes.ts";
import { githubChangedFiles, type GitHubFile } from "./patch.ts";

const GITHUB_API = "https://api.github.com";
const GITHUB_JSON = {
  Accept: "application/vnd.github+json",
};

export type PinnedSpec = {
  owner: string;
  repo: string;
  sha: string;
  path: string;
  content: string;
  htmlUrl: string;
  pullNumber?: number;
  pullUrl?: string;
  /** `base..head` of the pull request, for the Diff panel's default view. */
  pullRev?: Rev;
};

export type GitHubSpecResult =
  | { status: "ok"; spec: PinnedSpec }
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

type PullApi = {
  html_url?: string;
  head?: { sha?: string };
  base?: { sha?: string };
};

type CommitApi = {
  sha?: string;
  html_url?: string;
  commit?: { message?: string };
  files?: GitHubFile[];
};

type CompareApi = {
  html_url?: string;
  total_commits?: number;
  files?: GitHubFile[];
};

type ContentsApi = {
  type?: string;
  encoding?: string;
  content?: string;
  download_url?: string | null;
  size?: number;
};

const blobCache = new Map<string, Promise<string | Error>>();

export async function loadPinnedSpec(input: {
  owner: string;
  repo: string;
  path: string;
  sha?: string;
  pull?: number;
  signal?: AbortSignal;
}): Promise<GitHubSpecResult> {
  let sha = input.sha;
  let pullNumber = input.pull;
  let pullUrl: string | undefined;
  let pullRev: Rev | undefined;
  if (sha === undefined) {
    if (pullNumber === undefined) {
      return { status: "error", message: "Need a pull number or commit SHA." };
    }
    const resolved = await resolvePullHead(
      input.owner,
      input.repo,
      pullNumber,
      input.signal,
    );
    if (resolved.status !== "ok") return resolved;
    sha = resolved.sha;
    pullUrl = resolved.htmlUrl;
    pullRev =
      resolved.baseSha === undefined
        ? undefined
        : `${resolved.baseSha}..${sha}`;
  }

  const blob = await fetchPinnedBlob(
    { owner: input.owner, repo: input.repo, sha },
    input.path,
    input.signal,
  );
  if (blob instanceof Error) {
    if (blob.message === "not-found") return { status: "not-found" };
    if (blob.message === "forbidden") return { status: "forbidden" };
    return { status: "error", message: blob.message };
  }

  return {
    status: "ok",
    spec: {
      owner: input.owner,
      repo: input.repo,
      sha,
      path: input.path,
      content: blob,
      htmlUrl: `https://github.com/${input.owner}/${input.repo}/blob/${sha}/${input.path}`,
      pullNumber,
      pullUrl,
      pullRev,
    },
  };
}

export async function fetchPinnedBlob(
  pin: { owner: string; repo: string; sha: string },
  filePath: string,
  signal?: AbortSignal,
): Promise<string | Error> {
  const key = `${pin.owner}/${pin.repo}@${pin.sha}:${filePath}`;
  const pending = blobCache.get(key);
  if (pending !== undefined) return pending;

  const request = readContents(pin, filePath, signal).catch(
    (cause: unknown) => {
      blobCache.delete(key);
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      return cause instanceof Error
        ? cause
        : new Error("Failed to load this file from GitHub.");
    },
  );
  blobCache.set(key, request);
  return request;
}

export function findSymbolLineRange(contents: string, symbol: string) {
  const name = symbol.includes(".")
    ? symbol.slice(symbol.lastIndexOf(".") + 1)
    : symbol;
  const lines = contents.split(/\r?\n/);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:function|class|const|let|var|type|interface|enum|#)\\s+${escaped}\\b|\\b${escaped}\\s*[=:(]`,
  );
  for (let index = 0; index < lines.length; index++) {
    if (pattern.test(lines[index]!)) {
      return { start: index + 1, end: index + 1 };
    }
  }
  return { start: 1, end: Math.max(1, lines.length) };
}

async function resolvePullHead(
  owner: string,
  repo: string,
  pull: number,
  signal?: AbortSignal,
): Promise<
  | { status: "ok"; sha: string; baseSha: string | undefined; htmlUrl: string }
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "error"; message: string }
> {
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${String(pull)}`,
    signal,
  );
  if (response.status !== "ok") return response;
  const payload = (await response.body.json().catch(() => undefined)) as
    | PullApi
    | undefined;
  const sha = payload?.head?.sha;
  if (typeof sha !== "string" || sha.length === 0) {
    return {
      status: "error",
      message: "GitHub did not return a pull head SHA.",
    };
  }
  const baseSha = payload?.base?.sha;
  return {
    status: "ok",
    sha,
    baseSha: typeof baseSha === "string" ? baseSha : undefined,
    htmlUrl:
      typeof payload?.html_url === "string"
        ? payload.html_url
        : `https://github.com/${owner}/${repo}/pull/${String(pull)}`,
  };
}

const changesCache = new Map<string, Promise<Changes | Error>>();

/** Commit or compare changes from the GitHub API. Patches only, no full contents. */
export function fetchGitHubChanges(
  repo: { owner: string; repo: string },
  rev: Rev,
): Promise<Changes | Error> {
  if (rev === WORKING)
    return Promise.resolve(
      new Error("Uncommitted changes are only available in a local viewer."),
    );
  const key = `${repo.owner}/${repo.repo}@${rev}`;
  const pending = changesCache.get(key);
  if (pending !== undefined) return pending;
  const request = readGitHubChanges(repo, rev);
  changesCache.set(key, request);
  return request;
}

/** GitHub pages a commit's files up to 3000; a compare lists only its first 300. */
const COMMIT_FILES_MAX = 3000;
const COMPARE_FILES_MAX = 300;

async function readGitHubChanges(
  repo: { owner: string; repo: string },
  rev: Rev,
): Promise<Changes | Error> {
  const base = `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
  const [from, to] = rev.split("..");
  const files: GitHubFile[] = [];
  let first: (CommitApi & CompareApi) | undefined;
  let next: string | undefined =
    to === undefined
      ? `${base}/commits/${from!}`
      : `${base}/compare/${from!}...${to}`;
  while (next !== undefined) {
    const response = await githubFetch(next);
    if (response.status === "not-found")
      return new Error(
        `GitHub has no commit ${rev} in ${repo.owner}/${repo.repo}.`,
      );
    if (response.status === "forbidden")
      return new Error("GitHub rate-limited this request. Wait and refresh.");
    if (response.status === "error") return new Error(response.message);
    const payload = (await response.body.json().catch(() => undefined)) as
      | (CommitApi & CompareApi)
      | undefined;
    if (payload?.files === undefined)
      return new Error("GitHub returned invalid changes.");
    first ??= payload;
    files.push(...payload.files);
    // Compare pages list commits, not more files.
    next = to === undefined ? nextPage(response.body) : undefined;
  }
  const subject = first?.commit?.message?.split("\n", 1)[0] ?? "";
  const truncated =
    files.length >= (to === undefined ? COMMIT_FILES_MAX : COMPARE_FILES_MAX);
  return {
    rev,
    title:
      to === undefined
        ? subject
        : `${from!.slice(0, 7)}..${to.slice(0, 7)} · ${String(first?.total_commits ?? 0)} commits`,
    ...(first?.html_url === undefined ? {} : { url: first.html_url }),
    ...(truncated ? { truncated } : {}),
    files: githubChangedFiles(files),
  };
}

/** The API path of the `rel="next"` page in a GitHub `Link` header. */
function nextPage(response: Response) {
  const link = /<([^>]+)>;\s*rel="next"/.exec(
    response.headers.get("link") ?? "",
  );
  if (link === null) return undefined;
  const url = new URL(link[1]!);
  return `${url.pathname}${url.search}`;
}

async function readContents(
  pin: { owner: string; repo: string; sha: string },
  filePath: string,
  signal?: AbortSignal,
): Promise<string | Error> {
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const response = await githubFetch(
    `/repos/${encodeURIComponent(pin.owner)}/${encodeURIComponent(pin.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(pin.sha)}`,
    signal,
  );
  if (response.status === "not-found") return new Error("not-found");
  if (response.status === "forbidden") return new Error("forbidden");
  if (response.status === "error") return new Error(response.message);
  const payload = (await response.body.json().catch(() => undefined)) as
    | ContentsApi
    | ContentsApi[]
    | undefined;
  if (Array.isArray(payload)) {
    return new Error(`"${filePath}" is a directory at this commit.`);
  }
  if (payload === undefined) {
    return new Error(`Could not read "${filePath}" at this commit.`);
  }
  if (payload.type !== undefined && payload.type !== "file") {
    return new Error(`"${filePath}" is not a file at this commit.`);
  }
  if (payload.encoding === "base64" && typeof payload.content === "string") {
    return decodeBase64(payload.content.replace(/\n/g, ""));
  }
  if (
    typeof payload.download_url === "string" &&
    payload.download_url.length > 0
  ) {
    const raw = await fetch(payload.download_url, { signal }).catch(
      (cause: unknown) => cause,
    );
    if (raw instanceof Error) {
      if (raw.name === "AbortError") throw raw;
      return new Error(`Could not fetch "${filePath}" at this commit.`);
    }
    if (!(raw instanceof Response) || !raw.ok) {
      return new Error(`Could not fetch "${filePath}" at this commit.`);
    }
    return raw.text();
  }
  return new Error(`Could not read "${filePath}" at this commit.`);
}

function decodeBase64(value: string) {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (cause) {
    return new Error("GitHub returned invalid file encoding.", { cause });
  }
}

async function githubFetch(path: string, signal?: AbortSignal) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: GITHUB_JSON,
    signal,
  }).catch((cause: unknown) => cause);
  if (response instanceof Error) {
    if (response.name === "AbortError") throw response;
    return { status: "error" as const, message: "Failed to reach GitHub." };
  }
  if (!(response instanceof Response)) {
    return { status: "error" as const, message: "Failed to reach GitHub." };
  }
  if (response.status === 404) return { status: "not-found" as const };
  if (response.status === 403) return { status: "forbidden" as const };
  if (!response.ok) {
    return {
      status: "error" as const,
      message: `GitHub returned ${String(response.status)}.`,
    };
  }
  return { status: "ok" as const, body: response };
}
