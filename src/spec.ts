/**
 * A spec is a directory whose README.md is the cover and whose other Markdown
 * files are pages, ordered by a number prefix such as `02-`. The local, gist,
 * and GitHub viewers all order pages with these functions, so this file stays
 * free of Node imports.
 */
import { DiffmapSpecError } from "./errors.js";

export type SpecPage = {
  /** File name in the spec's directory, such as `02-write-through.md`. */
  file: string;
  /** The page's URL segment: the file name without its number and extension, or "" for the cover. */
  slug: string;
  /** The page's first `#` heading, or its file name. */
  title: string;
};

export type Spec<Page extends SpecPage = SpecPage> = {
  /** The cover's title. */
  title: string;
  /** The cover first, then the pages in order. */
  pages: Page[];
};

const MARKDOWN = /\.mdx?$/i;
const COVER = /^readme\.mdx?$/i;
const NUMBERED = /^(\d+)-(.+)\.mdx?$/i;
const TITLE = /^#\s+(.+)$/m;

export function isMarkdownFile(name: string) {
  return MARKDOWN.test(name);
}

/** A name a spec's page can have: README.md, or a numbered Markdown file. */
export function isPageFileName(name: string) {
  return COVER.test(name) || NUMBERED.test(name);
}

/**
 * Orders a spec directory's files: README.md first, then every other Markdown
 * file by its number prefix. Other files, such as media, are ignored.
 */
export function makeSpec<File extends { file: string; source: string }>(
  dir: string,
  files: File[],
) {
  const markdown = files.filter((entry) => isMarkdownFile(entry.file));
  const cover = markdown.find((entry) => COVER.test(entry.file));
  if (cover === undefined) {
    return new DiffmapSpecError({
      path: dir,
      reason:
        "no README.md. A spec's README.md is its cover: the problem, the solution, goals, and non-goals",
    });
  }
  const numbered: { entry: File; order: number; slug: string }[] = [];
  for (const entry of markdown) {
    if (entry === cover) continue;
    const match = NUMBERED.exec(entry.file);
    if (match === null) {
      return new DiffmapSpecError({
        path: dir,
        reason: `${entry.file} needs a number prefix that sets its place in the spec, as in 01-${entry.file}`,
      });
    }
    numbered.push({ entry, order: Number(match[1]), slug: match[2]! });
  }
  numbered.sort(
    (a, b) => a.order - b.order || a.entry.file.localeCompare(b.entry.file),
  );
  const slugs = new Map<string, string>();
  for (const { entry, slug } of numbered) {
    const other = slugs.get(slug.toLowerCase());
    if (other !== undefined) {
      return new DiffmapSpecError({
        path: dir,
        reason: `${other} and ${entry.file} have the same name after their numbers, so they would share the URL /${slug}`,
      });
    }
    slugs.set(slug.toLowerCase(), entry.file);
  }
  return specOf([
    { entry: cover, slug: "" },
    ...numbered.map(({ entry, slug }) => ({ entry, slug })),
  ]);
}

function specOf<File extends { file: string; source: string }>(
  pages: { entry: File; slug: string }[],
): Spec<File & SpecPage> {
  const withTitles = pages.map(({ entry, slug }) => ({
    ...entry,
    slug,
    title: TITLE.exec(entry.source)?.[1]?.trim() ?? entry.file,
  }));
  return { title: withTitles[0]!.title, pages: withTitles };
}

/** The page a URL segment names: its slug, or its file name so links to files keep working. */
export function findPage<Page extends SpecPage>(
  spec: Spec<Page>,
  requested: string | undefined,
) {
  if (requested === undefined || requested === "") return spec.pages[0];
  const wanted = requested.toLowerCase();
  return spec.pages.find(
    (page) =>
      page.slug.toLowerCase() === wanted || page.file.toLowerCase() === wanted,
  );
}

/** The page a relative link in a page names, such as `02-write-through.md#tests`, with its `#` fragment. */
export function linkedPage<Page extends SpecPage>(
  spec: Spec<Page>,
  href: string,
) {
  const hashAt = href.indexOf("#");
  const target = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  // Only a file beside the page can be a page; a scheme, a path, or a bare `#heading` is not.
  const file = target.replace(/^\.\//, "");
  if (file === "" || file.includes("/") || file.includes(":")) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(file);
  } catch {
    return undefined;
  }
  const page = spec.pages.find(
    (candidate) => candidate.file.toLowerCase() === decoded.toLowerCase(),
  );
  return page === undefined ? undefined : { page, hash };
}
