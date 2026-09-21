import { useEffect, useState } from "react";
import type { CodeViewDiffItem, CodeViewLineSelection } from "@pierre/diffs";
import type { SourceReference } from "../annotations.js";
import type { SourceDefinition, DefinitionResponse } from "../definitions.js";
import { DiffmapDefinitionError } from "../errors.js";
import { useGitHubPin } from "../github/pin.ts";
import { fetchPinnedBlob, findSymbolLineRange } from "../github/fetchRepo.ts";
import { useHostFiles } from "../host/files.ts";
import { useViewerMode } from "./viewerMode.ts";

export async function requestSource(
  endpoint: "source" | "definition",
  params: URLSearchParams,
) {
  const response = await fetch(`/__diffmap/${endpoint}?${params}`).catch(
    (cause) =>
      new DiffmapDefinitionError({
        reason: "Could not reach the source service.",
        cause,
      }),
  );
  if (response instanceof Error) return response;
  const result = await response
    .json()
    .then((value) => {
      // SAFETY: the local diffmap source endpoints own this response shape.
      return value as DefinitionResponse;
    })
    .catch(
      (cause) =>
        new DiffmapDefinitionError({
          reason: "Could not read the source response.",
          cause,
        }),
    );
  if (result instanceof Error) return result;
  if (result.error !== undefined)
    return new DiffmapDefinitionError({ reason: result.error });
  if (result.definition === undefined)
    return new DiffmapDefinitionError({ reason: "No definition found." });
  return result.definition;
}

export function useSourceReference(reference: SourceReference | undefined) {
  const [resolution, setResolution] = useState<{
    reference: SourceReference;
    result: SourceDefinition | Error;
  }>();
  const pin = useGitHubPin();
  const hostFiles = useHostFiles();
  const mode = useViewerMode();
  const hostResult =
    reference?.kind === "file" && hostFiles !== undefined
      ? readHostFileReference(hostFiles, reference)
      : undefined;
  useEffect(() => {
    if (reference?.kind !== "file") return;
    if (hostFiles !== undefined) return;
    let active = true;
    if (pin !== undefined) {
      // Pinned GitHub spec: load this path at the spec commit SHA, never main.
      // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns its asynchronous source result.
      void fetchPinnedBlob(pin, reference.path).then((contents) => {
        if (!active) return;
        if (contents instanceof Error) {
          const message =
            contents.message === "not-found"
              ? `Could not read ${reference.path} at this commit.`
              : contents.message;
          setResolution({
            reference,
            result: new DiffmapDefinitionError({ reason: message }),
          });
          return;
        }
        const lineCount = Math.max(1, contents.split(/\r?\n/).length);
        const range =
          reference.symbol !== undefined
            ? findSymbolLineRange(contents, reference.symbol)
            : {
                start: reference.start ?? 1,
                end: reference.end ?? lineCount,
              };
        setResolution({
          reference,
          result: {
            path: reference.path,
            contents,
            start: range.start,
            end: range.end,
          },
        });
      });
      return () => {
        active = false;
      };
    }
    if (mode !== "local") return;
    const params = new URLSearchParams({ path: reference.path });
    if (reference.symbol !== undefined) params.set("symbol", reference.symbol);
    if (reference.start !== undefined)
      params.set("start", String(reference.start));
    if (reference.end !== undefined) params.set("end", String(reference.end));
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns its asynchronous source result.
    void requestSource("source", params).then((result) => {
      if (active) setResolution({ reference, result });
    });
    return () => {
      active = false;
    };
  }, [reference, pin, mode, hostFiles]);
  if (hostResult !== undefined) return hostResult;
  return resolution?.reference === reference ? resolution?.result : undefined;
}

function readHostFileReference(
  files: Record<string, string>,
  reference: Extract<SourceReference, { kind: "file" }>,
): SourceDefinition | Error {
  const contents = files[reference.path];
  if (contents === undefined) {
    return new DiffmapDefinitionError({
      reason: `No hosted file for ${reference.path}.`,
    });
  }
  const lineCount = Math.max(1, contents.split(/\r?\n/).length);
  const range =
    reference.symbol !== undefined
      ? findSymbolLineRange(contents, reference.symbol)
      : {
          start: reference.start ?? 1,
          end: reference.end ?? lineCount,
        };
  return {
    path: reference.path,
    contents,
    start: range.start,
    end: range.end,
  };
}

export function matchingSourceDiff(
  source: SourceDefinition,
  items: CodeViewDiffItem[],
): CodeViewLineSelection | undefined {
  const lines = source.contents.split(/\r?\n/);
  for (const item of items) {
    const diff = item.fileDiff;
    if (diff.name !== source.path) continue;
    const ranges = diff.hunks.flatMap((hunk) => {
      const start = Math.max(source.start, hunk.additionStart);
      const end = Math.min(
        source.end,
        hunk.additionStart + hunk.additionCount - 1,
      );
      return start <= end ? [{ start, end, hunk }] : [];
    });
    if (ranges.length === 0) continue;
    const matches = ranges.every(({ start, end, hunk }) => {
      for (let line = start; line <= end; line++) {
        const index = diff.isPartial
          ? hunk.additionLineIndex + line - hunk.additionStart
          : line - 1;
        if (
          diff.additionLines[index]?.replace(/\r?\n$/, "") !== lines[line - 1]
        )
          return false;
      }
      return true;
    });
    if (!matches) continue;
    return {
      id: item.id,
      range: {
        start: Math.min(...ranges.map((range) => range.start)),
        end: Math.max(...ranges.map((range) => range.end)),
        side: "additions",
      },
    };
  }
  return undefined;
}
