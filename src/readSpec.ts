import fs from "node:fs/promises";
import path from "node:path";
import { isMarkdownFile, isPageFileName, makeSpec } from "./spec.js";
import { DiffmapSpecError, DiffmapFileError } from "./errors.js";
import { parseViewerDocument } from "./parseViewer.js";

/** Reads a spec: a directory with a README.md cover and numbered pages. */
export async function readSpec(target: string) {
  const stat = await fs
    .stat(target)
    .catch(
      (cause) => new DiffmapFileError({ path: target, reason: "read", cause }),
    );
  if (stat instanceof Error) return stat;
  if (!stat.isDirectory()) {
    const dir = path.dirname(target);
    const file = path.basename(target);
    return new DiffmapSpecError({
      path: target,
      reason: `a spec is a directory, not a file. ${
        isPageFileName(file)
          ? `Pass this page's spec, ${dir}`
          : isMarkdownFile(file)
            ? `Move this file to ${path.join(dir, file.replace(/\.mdx?$/i, ""), "README.md")} and give each phase its own numbered page`
            : "Pass the directory that holds its README.md and numbered pages"
      }`,
    });
  }
  const names = await fs
    .readdir(target)
    .catch(
      (cause) => new DiffmapFileError({ path: target, reason: "read", cause }),
    );
  if (names instanceof Error) return names;
  const files = [];
  for (const file of names.filter(isMarkdownFile).toSorted()) {
    const filePath = path.join(target, file);
    const source = await readSource(filePath);
    if (source instanceof Error) return source;
    files.push({ file, path: filePath, source });
  }
  const spec = makeSpec(target, files);
  if (spec instanceof Error) return spec;
  return { dir: target, spec };
}

export type ReadSpec = Exclude<Awaited<ReturnType<typeof readSpec>>, Error>;

/** Parses every page, naming the page that fails. */
export function parseSpec(read: ReadSpec) {
  const pages = [];
  for (const page of read.spec.pages) {
    const document = parseViewerDocument(page.source, page.path);
    if (document instanceof Error) {
      // Most parse errors, such as Mermaid's, already name the page.
      return document.message.includes(page.path)
        ? document
        : new DiffmapSpecError({ path: page.path, reason: document.message });
    }
    pages.push({ ...page, document });
  }
  return pages;
}

function readSource(filePath: string) {
  return fs
    .readFile(filePath, "utf8")
    .catch(
      (cause) =>
        new DiffmapFileError({ path: filePath, reason: "read", cause }),
    );
}
