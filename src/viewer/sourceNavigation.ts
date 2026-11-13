import { useEffect, useMemo, useState } from "react";
import type { SourceReference } from "../annotations.js";
import type { SourceDefinition, DefinitionResponse } from "../definitions.js";
import { DiffmapDefinitionError } from "../errors.js";
import { useGitHubPin } from "../github/pin.ts";
import { fetchPinnedBlob, findSymbolLineRange } from "../github/fetchRepo.ts";
import { useHostFiles } from "../host/files.ts";
import { useViewerMode } from "./viewerMode.ts";
import { trackViewerEvent } from "./telemetry.ts";

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

export function useSourceReference(
  reference: SourceReference | undefined,
  snapshots?: Record<string, string>,
) {
  const [resolution, setResolution] = useState<{
    reference: SourceReference;
    result: SourceDefinition | Error;
  }>();
  const pin = useGitHubPin();
  const currentFiles = useHostFiles();
  const mode = useViewerMode();
  const hostFiles =
    reference?.rev !== undefined
      ? (snapshots ?? (mode === "gist" ? EMPTY_FILES : undefined))
      : currentFiles;
  const hostResult = useMemo(() => {
    if (reference?.kind !== "file" || hostFiles === undefined) return undefined;
    return readHostFileReference(hostFiles, reference);
  }, [reference, hostFiles]);
  useEffect(() => {
    if (reference?.kind !== "file") return;
    if (hostFiles !== undefined) return;
    let active = true;
    if (pin !== undefined) {
      // An explicit reference rev overrides the spec's own pin.
      // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns its asynchronous source result.
      void fetchPinnedBlob(
        reference.rev === undefined
          ? pin
          : { ...pin, sha: reference.rev.split("..").at(-1)! },
        reference.path,
      ).then((contents) => {
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
    if (reference.rev !== undefined) params.set("rev", reference.rev);
    if (reference.symbol !== undefined) params.set("symbol", reference.symbol);
    if (reference.start !== undefined)
      params.set("start", String(reference.start));
    if (reference.end !== undefined) params.set("end", String(reference.end));
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns its asynchronous source result.
    void requestSource("source", params).then((result) => {
      // A reference the spec names but the workspace does not have.
      if (result instanceof Error)
        trackViewerEvent({ event: "viewer_error", kind: "source" });
      if (active) setResolution({ reference, result });
    });
    return () => {
      active = false;
    };
  }, [reference, pin, mode, hostFiles]);
  if (hostResult !== undefined) return hostResult;
  return resolution?.reference === reference ? resolution?.result : undefined;
}

const EMPTY_FILES: Record<string, string> = {};

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
