import { useEffect, useState } from "react";
import { File } from "@pierre/diffs/react";
import { useTheme } from "maui";
import { useStyles } from "purse-styles";
import { pierreFileOptions, pierreShell } from "./pierre.ts";
import { useViewerMode } from "./viewerMode.ts";
import { useGitHubPin } from "../github/pin.ts";
import { useHostFiles } from "../host/files.ts";
import { fetchPinnedBlob } from "../github/fetchRepo.ts";

type FileExcerptPayload = {
  path: string;
  start: number;
  end: number;
  contents: string;
};

export function FileExcerpt(props: {
  path: string;
  start: number;
  end: number;
  fallback: string;
}) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(pierreShell);
  const excerpt = useFileExcerpt(props);
  const pierre = pierreFileOptions(resolvedTheme);

  return (
    <div className={shell} data-file-path={props.path} data-diffmap-kind="file">
      <File
        file={{
          name: props.path,
          contents: excerpt === undefined ? props.fallback : excerpt.contents,
        }}
        disableWorkerPool
        options={pierre}
      />
    </div>
  );
}

function useFileExcerpt(input: { path: string; start: number; end: number }) {
  const [excerpt, setExcerpt] = useState<FileExcerptPayload>();
  const mode = useViewerMode();
  const pin = useGitHubPin();
  const hostFiles = useHostFiles();
  const hostExcerpt = hostFileExcerpt(hostFiles, input);
  useEffect(() => {
    if (hostFiles !== undefined) return;
    if (mode === "github") {
      if (pin === undefined) return;
      // oxlint-disable-next-line typescript/no-floating-promises -- React effects cannot await; this request owns the excerpt update.
      void fetchPinnedBlob(pin, input.path)
        .then((contents) => {
          if (contents instanceof Error) return undefined;
          const lines = contents.split(/\r?\n/);
          const start = input.start;
          const end = Math.min(input.end, lines.length);
          return {
            path: input.path,
            start,
            end,
            contents: lines.slice(start - 1, end).join("\n"),
          } satisfies FileExcerptPayload;
        })
        .then((value) => {
          if (value !== undefined) setExcerpt(value);
        })
        .catch((cause) => {
          console.warn("diffmap file excerpt failed", cause);
        });
      return;
    }
    if (mode !== "local") return;
    const params = new URLSearchParams({
      path: input.path,
      start: String(input.start),
      end: String(input.end),
    });
    void fetch(`/__diffmap/file?${params.toString()}`)
      .then((response) => {
        if (!response.ok) return undefined;
        return response.json();
      })
      .then((value) => {
        if (value === undefined) return;
        // SAFETY: the diffmap CLI serves FileExcerpt JSON for this route.
        setExcerpt(value as FileExcerptPayload);
      })
      .catch((cause) => {
        console.warn("diffmap file excerpt failed", cause);
      });
  }, [input.path, input.start, input.end, mode, pin, hostFiles]);
  return hostExcerpt ?? excerpt;
}

function hostFileExcerpt(
  files: Record<string, string> | undefined,
  input: { path: string; start: number; end: number },
): FileExcerptPayload | undefined {
  if (files === undefined) return undefined;
  const contents = files[input.path];
  if (contents === undefined) return undefined;
  const lines = contents.split(/\r?\n/);
  const start = input.start;
  const end = Math.min(input.end, lines.length);
  return {
    path: input.path,
    start,
    end,
    contents: lines.slice(start - 1, end).join("\n"),
  };
}
