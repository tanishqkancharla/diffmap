import { useEffect, useMemo, useState } from "react";
import type { ChangedFile } from "../changes.js";
import { hashNumber } from "./lineComments.tsx";

/** Each reviewed file's path, mapped to the hash of the diff the reader reviewed. */
type ReviewedFiles = Record<string, number>;

/**
 * Files the reader marked reviewed, saved in localStorage under `key`. A file
 * counts as reviewed only while its diff is the one the reader saw, so a file
 * that changes afterwards needs reviewing again.
 */
export function useReviewedFiles(key: string) {
  const [reviewed, setReviewed] = useState(() => loadReviewed(key));
  useEffect(() => {
    try {
      if (Object.keys(reviewed).length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(reviewed));
    } catch (cause) {
      console.warn("diffmap could not save reviewed files", cause);
    }
  }, [key, reviewed]);
  return useMemo(
    () => ({
      isReviewed: (file: ChangedFile) => reviewed[file.path] === diffHash(file),
      setReviewed: (file: ChangedFile, value: boolean) =>
        setReviewed((current) => {
          const { [file.path]: _, ...rest } = current;
          return value ? { ...rest, [file.path]: diffHash(file) } : rest;
        }),
    }),
    [reviewed],
  );
}

// Files can be large and every render asks, so each loaded file is hashed once.
const hashes = new WeakMap<ChangedFile, number>();

function diffHash(file: ChangedFile) {
  let hash = hashes.get(file);
  if (hash === undefined) {
    hash = hashNumber(
      JSON.stringify([file.prevPath, file.contents, file.patch]),
    );
    hashes.set(file, hash);
  }
  return hash;
}

function loadReviewed(key: string): ReviewedFiles {
  try {
    const saved = localStorage.getItem(key);
    // SAFETY: only useReviewedFiles writes this key, with this shape.
    return saved === null ? {} : (JSON.parse(saved) as ReviewedFiles);
  } catch {
    return {};
  }
}
