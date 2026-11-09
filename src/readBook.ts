import fs from "node:fs/promises";
import path from "node:path";
import { isMarkdownFile, makeBook, singlePageBook } from "./book.js";
import { DiffmapBookError, DiffmapFileError } from "./errors.js";
import { parseViewerDocument } from "./parseViewer.js";

/** Reads a book directory, or a single spec file as a book with only a cover. */
export async function readBook(target: string) {
  const stat = await fs
    .stat(target)
    .catch(
      (cause) => new DiffmapFileError({ path: target, reason: "read", cause }),
    );
  if (stat instanceof Error) return stat;
  if (!stat.isDirectory()) {
    const source = await readSource(target);
    if (source instanceof Error) return source;
    return {
      dir: path.dirname(target),
      directory: false,
      book: singlePageBook({
        file: path.basename(target),
        path: target,
        source,
      }),
    };
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
  const book = makeBook(target, files);
  if (book instanceof Error) return book;
  return { dir: target, directory: true, book };
}

export type ReadBook = Exclude<Awaited<ReturnType<typeof readBook>>, Error>;

/** Parses every page, naming the page that fails. */
export function parseBook(read: ReadBook) {
  const pages = [];
  for (const page of read.book.pages) {
    const document = parseViewerDocument(page.source, page.path);
    if (document instanceof Error) {
      return read.directory
        ? new DiffmapBookError({ path: page.path, reason: document.message })
        : document;
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
