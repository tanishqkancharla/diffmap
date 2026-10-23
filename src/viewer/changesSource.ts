import { createContext, useContext, useEffect, useState } from "react";
import {
  isCommitRev,
  type Delta,
  type DeltasResponse,
  type Changes,
  type ChangesResponse,
  type Rev,
} from "../changes.js";
import { DiffmapDefinitionError } from "../errors.js";

/** Where a viewer reads changes: the local server, GitHub, or a gist snapshot. */
export type ChangesLoader = (rev: Rev) => Promise<Changes | Error>;

const localCache = new Map<Rev, Promise<Changes | Error>>();

/** Commits never change, so they are cached; anything uncommitted is re-read. */
export const loadLocalChanges: ChangesLoader = (rev) => {
  const cached = localCache.get(rev);
  if (cached !== undefined) return cached;
  const request = fetch(`/__diffmap/changes?${new URLSearchParams({ rev })}`)
    .then((response) => response.json())
    .then((value) => {
      // SAFETY: the local diffmap server owns this response shape.
      const result = value as ChangesResponse;
      if (result.changes !== undefined) return result.changes;
      return new DiffmapDefinitionError({
        reason: result.error ?? "Could not load changes.",
      });
    })
    .catch(
      (cause) =>
        new DiffmapDefinitionError({
          reason: "Could not reach the source service.",
          cause,
        }),
    );
  if (isCommitRev(rev)) localCache.set(rev, request);
  return request;
};

/** The range picker's rows. Always re-read: uncommitted changes and HEAD move. */
export async function loadLocalDeltas(rev: Rev): Promise<Delta[] | Error> {
  const result = await fetch(
    `/__diffmap/deltas?${new URLSearchParams({ rev })}`,
  )
    .then((response) => response.json())
    .then((value) => {
      // SAFETY: the local diffmap server owns this response shape.
      return value as DeltasResponse;
    })
    .catch(
      (cause) =>
        new DiffmapDefinitionError({
          reason: "Could not reach the source service.",
          cause,
        }),
    );
  if (result instanceof Error) return result;
  return (
    result.deltas ??
    new DiffmapDefinitionError({
      reason: result.error ?? "Could not list changes.",
    })
  );
}

export const ChangesLoaderContext =
  createContext<ChangesLoader>(loadLocalChanges);

export function useChanges(rev: Rev) {
  const load = useContext(ChangesLoaderContext);
  const [loaded, setLoaded] = useState<{
    rev: Rev;
    load: ChangesLoader;
    result: Changes | Error;
  }>();
  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns this request and ignores it after cleanup.
    void load(rev).then((result) => {
      if (active) setLoaded({ rev, load, result });
    });
    return () => {
      active = false;
    };
  }, [rev, load]);
  return loaded?.rev === rev && loaded.load === load
    ? loaded.result
    : undefined;
}
