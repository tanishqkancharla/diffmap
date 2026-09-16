import { githubGistUrl, markdownFileNames, pickMarkdownFile } from "./route.ts";

export type GistMarkdownFile = {
  name: string;
  content: string;
};

export type GistDocument = {
  id: string;
  htmlUrl: string;
  files: GistMarkdownFile[];
  chosen: GistMarkdownFile;
};

export type GistLoadResult =
  | { status: "ok"; gist: GistDocument }
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "no-markdown"; htmlUrl: string }
  | { status: "missing-file"; htmlUrl: string; files: GistMarkdownFile[] }
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

export async function loadGistMarkdown(
  gistId: string,
  fileName: string | undefined,
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

  const chosenName = pickMarkdownFile(
    files.map((file) => file.name),
    fileName,
  );
  const chosen = files.find((file) => file.name === chosenName);
  if (chosen === undefined) {
    return { status: "missing-file", htmlUrl, files };
  }

  return {
    status: "ok",
    gist: {
      id: typeof payload.id === "string" ? payload.id : gistId,
      htmlUrl,
      files,
      chosen,
    },
  };
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
