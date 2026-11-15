import { useCallback, useSyncExternalStore } from "react";

/** Each reviewed flow state, by `flow:<path>`, mapped to the fingerprint of the UI the reader reviewed. */
type Reviewed = Record<string, string>;

const listeners = new Set<() => void>();
const cache = new Map<string, Reviewed>();

// localStorage is per origin, so the path names the document, as for reviewed files.
function storageKey() {
  return `diffmap-reviewed-previews:${window.location.pathname}`;
}

function read(): Reviewed {
  const key = storageKey();
  let reviewed = cache.get(key);
  if (reviewed === undefined) {
    try {
      // SAFETY: only this module writes this key, with this shape.
      reviewed = JSON.parse(localStorage.getItem(key) ?? "{}") as Reviewed;
    } catch {
      reviewed = {};
    }
    cache.set(key, reviewed);
  }
  return reviewed;
}

function write(next: Reviewed) {
  const key = storageKey();
  cache.set(key, next);
  try {
    if (Object.keys(next).length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(next));
  } catch (cause) {
    console.warn("diffmap could not save reviewed previews", cause);
  }
  for (const listener of listeners) listener();
}

/**
 * Previews the reader marked reviewed. Like reviewed files, a mark holds only while the UI is the one the reader saw:
 * when a story's markup changes, its fingerprint does, and it needs reviewing again.
 */
export function useReviewedStates() {
  const reviewed = useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, read);
  const isReviewed = useCallback(
    (id: string, fingerprint: string | undefined) =>
      fingerprint !== undefined && reviewed[id] === fingerprint,
    [reviewed],
  );
  const setReviewed = useCallback(
    (id: string, fingerprint: string, value: boolean) => {
      const { [id]: _, ...rest } = read();
      write(value ? { ...rest, [id]: fingerprint } : rest);
    },
    [],
  );
  return { isReviewed, setReviewed };
}
