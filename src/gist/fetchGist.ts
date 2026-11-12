import {
  GIST_CHANGES_FILE,
  GIST_FILES_FILE,
  type Changes,
  type Rev,
} from "../changes.ts";
import { findPage, makeSpec, type Spec, type SpecPage } from "../spec.ts";
import type { HostFiles } from "../host/files.ts";
import { githubGistUrl, markdownFileNames, pickMarkdownFile } from "./route.ts";

export type GistMarkdownFile = {
  name: string;
  content: string;
};

export type GistDocument = {
  id: string;
  htmlUrl: string;
  files: GistMarkdownFile[];
  /** The pages, when the gist's Markdown files form a spec: a README.md and numbered pages. */
  spec: Spec<SpecPage & { source: string }> | undefined;
  /** Snapshot `diffmap share` saved for each commit and changes card the spec references. */
  changes: Record<Rev, Changes>;
  /** Files excerpts and references without a commit read, as they were when shared. */
  sourceFiles: HostFiles;
};

export type GistLoadResult =
  | { status: "ok"; gist: GistDocument }
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "no-markdown"; htmlUrl: string }
  | { status: "error"; message: string };

type GistApiFile = {
  filename?: string;
  truncated?: boolean;
  content?: string;
  raw_url?: string;
};

type GistApiResponse = {
  id?: string;
  html_url?: string;
  files?: Record<string, GistApiFile>;
};

/** Every Markdown file in a gist, and the snapshots `diffmap share` saved beside them. */
export async function loadGistMarkdown(
  gistId: string,
  signal?: AbortSignal,
): Promise<GistLoadResult> {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  }).catch((cause: unknown) => cause);

  if (response instanceof Error) {
    if (response.name === "AbortError") throw response;
    return { status: "error", message: "Failed to load this gist." };
  }
  if (!(response instanceof Response)) {
    return { status: "error", message: "Failed to load this gist." };
  }
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 403) return { status: "forbidden" };
  if (!response.ok) {
    return {
      status: "error",
      message: `GitHub returned ${String(response.status)}.`,
    };
  }

  const payload = (await response.json().catch(() => undefined)) as
    | GistApiResponse
    | undefined;
  if (payload === undefined) {
    return { status: "error", message: "GitHub returned an invalid gist." };
  }

  const htmlUrl =
    typeof payload.html_url === "string" && payload.html_url.length > 0
      ? payload.html_url
      : githubGistUrl(gistId);
  const apiFiles = payload.files ?? {};
  const names = markdownFileNames(Object.keys(apiFiles));
  if (names.length === 0) return { status: "no-markdown", htmlUrl };

  const files: GistMarkdownFile[] = [];
  for (const name of names) {
    const file = apiFiles[name];
    if (file === undefined) continue;
    const content = await readGistFile(file, signal);
    if (content instanceof Error) {
      return { status: "error", message: content.message };
    }
    files.push({ name, content });
  }
  if (files.length === 0) return { status: "no-markdown", htmlUrl };

  // SAFETY: diffmap share writes this file from readDocumentChanges.
  const changes = (await readSnapshot(apiFiles, GIST_CHANGES_FILE, signal)) as
    | Record<Rev, Changes>
    | Error;
  if (changes instanceof Error) {
    return { status: "error", message: changes.message };
  }
  // SAFETY: diffmap share writes this file as path to contents.
  const sourceFiles = (await readSnapshot(
    apiFiles,
    GIST_FILES_FILE,
    signal,
  )) as HostFiles | Error;
  if (sourceFiles instanceof Error) {
    return { status: "error", message: sourceFiles.message };
  }

  return {
    status: "ok",
    gist: {
      id: typeof payload.id === "string" ? payload.id : gistId,
      htmlUrl,
      files,
      spec: gistSpec(gistId, files),
      changes,
      sourceFiles,
    },
  };
}

/** A JSON file `diffmap share` wrote, or `{}` when the gist predates it. */
async function readSnapshot(
  apiFiles: Record<string, GistApiFile>,
  name: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const file = apiFiles[name];
  if (file === undefined) return {};
  const text = await readGistFile(file, signal);
  if (text instanceof Error) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return new Error(`${name} is not valid JSON.`);
  }
}

async function readGistFile(file: GistApiFile, signal?: AbortSignal) {
  const name = file.filename ?? "file";
  if (file.truncated !== true && typeof file.content === "string") {
    return file.content;
  }
  if (file.raw_url === undefined || file.raw_url.length === 0) {
    return new Error(`Gist file "${name}" is truncated and has no raw URL.`);
  }
  const raw = await fetch(file.raw_url, { signal }).catch(
    (cause: unknown) => cause,
  );
  if (raw instanceof Error) {
    if (raw.name === "AbortError") throw raw;
    return new Error(`Could not fetch gist file "${name}".`);
  }
  if (!(raw instanceof Response) || !raw.ok) {
    return new Error(`Could not fetch gist file "${name}".`);
  }
  return raw.text();
}

function gistSpec(gistId: string, files: GistMarkdownFile[]) {
  const spec = makeSpec(
    gistId,
    files.map((file) => ({ file: file.name, source: file.content })),
  );
  return spec instanceof Error ? undefined : spec;
}

/** The file a gist URL names: a spec's page by slug or file name, or another gist's file by name. */
export function chooseGistFile(
  gist: GistDocument,
  requested: string | undefined,
) {
  if (gist.spec !== undefined) {
    const page = findPage(gist.spec, requested);
    return page === undefined
      ? undefined
      : { name: page.file, content: page.source, page };
  }
  const name = pickMarkdownFile(
    gist.files.map((file) => file.name),
    requested,
  );
  const file = gist.files.find((candidate) => candidate.name === name);
  return file === undefined ? undefined : { ...file, page: undefined };
}
