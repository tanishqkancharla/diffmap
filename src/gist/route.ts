export const DIFFMAP_ORIGIN = "https://diffmap.dev";
export const GIST_ID_PATTERN = /^[0-9a-f]{32}$/i;
const GIST_URL_PATTERN =
  /(?:https?:\/\/)?gist\.github\.com\/(?:[^/]+\/)?([0-9a-f]{32})/i;
const MARKDOWN_EXT = /\.(?:md|mdx)$/i;

export type GistRoute =
  | { kind: "home" }
  | { kind: "empty" }
  | { kind: "invalid"; value: string }
  | { kind: "gist"; gistId: string; file: string | undefined };

export function extractGistId(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (GIST_ID_PATTERN.test(trimmed)) return trimmed.toLowerCase();
  const fromUrl = GIST_URL_PATTERN.exec(trimmed);
  if (fromUrl?.[1] !== undefined) return fromUrl[1].toLowerCase();
  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded !== trimmed) return extractGistId(decoded);
  } catch {
    return undefined;
  }
  return undefined;
}

export function parsePiGistHash(hash: string) {
  const raw = hash.replace(/^#/, "").split("&", 1)[0] ?? "";
  if (raw.length === 0) return undefined;
  const [idPart, ...fileParts] = raw.split("/");
  const gistId = extractGistId(idPart ?? "");
  if (gistId === undefined) return undefined;
  const file =
    fileParts.length === 0
      ? undefined
      : fileParts.map(decodePathSegment).join("/");
  return { gistId, file };
}

export function parseGistPath(pathname: string): GistRoute {
  const path = normalizePath(pathname);
  const parts = path.split("/").filter((part) => part.length > 0);
  if (parts.length === 0) return { kind: "home" };
  if (parts[0] !== "g") return { kind: "home" };
  if (parts.length === 1) return { kind: "empty" };

  const rest = parts.slice(1).join("/");
  const nestedId = extractGistId(rest) ?? extractGistId(path);
  const firstId = extractGistId(decodePathSegment(parts[1] ?? ""));
  const gistId = firstId ?? nestedId;
  if (gistId === undefined) {
    return { kind: "invalid", value: decodePathSegment(parts[1] ?? "") };
  }
  const file =
    firstId === undefined || parts.length === 2
      ? undefined
      : parts.slice(2).map(decodePathSegment).join("/");
  return {
    kind: "gist",
    gistId,
    file: file === undefined || file.length === 0 ? undefined : file,
  };
}

export function rewritePiGistUrl(pathname: string, hash: string) {
  const parsed = parseGistPath(pathname);
  if (parsed.kind !== "empty") return undefined;
  const pi = parsePiGistHash(hash);
  if (pi === undefined) return undefined;
  return gistPath(pi.gistId, pi.file);
}

export function gistPath(gistId: string, file?: string) {
  if (file === undefined || file.length === 0) return `/g/${gistId}`;
  return `/g/${gistId}/${file.split("/").map(encodeURIComponent).join("/")}`;
}

export function gistViewerUrl(
  gistId: string,
  file?: string,
  origin = DIFFMAP_ORIGIN,
) {
  return `${origin}${gistPath(gistId, file)}`;
}

export function githubGistUrl(gistId: string) {
  return `https://gist.github.com/${gistId}`;
}

export function markdownFileNames(files: string[]) {
  return files
    .filter((name) => MARKDOWN_EXT.test(name))
    .toSorted((a, b) => a.localeCompare(b));
}

export function pickMarkdownFile(
  files: string[],
  requested: string | undefined,
) {
  const markdown = markdownFileNames(files);
  if (requested !== undefined && requested.length > 0) {
    const exact = files.find((name) => name === requested);
    if (exact !== undefined && MARKDOWN_EXT.test(exact)) return exact;
    return markdown.find(
      (name) => name.toLowerCase() === requested.toLowerCase(),
    );
  }
  const readme = markdown.find((name) => name.toLowerCase() === "readme.md");
  if (readme !== undefined) return readme;
  if (markdown.length === 1) return markdown[0];
  for (const preferred of ["walkthrough.md", "spec.md"]) {
    const found = markdown.find((name) => name.toLowerCase() === preferred);
    if (found !== undefined) return found;
  }
  return markdown[0];
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
