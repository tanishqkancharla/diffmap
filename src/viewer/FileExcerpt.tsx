import { useEffect, useState } from "react";
import { File } from "@pierre/diffs/react";
import { useTheme } from "maui";
import { useStyles } from "purse-styles";
import { pierreFileOptions, pierreShell } from "./pierre.ts";
import { useViewerMode } from "./viewerMode.ts";

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
  useEffect(() => {
    if (mode === "gist") return;
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
  }, [input.path, input.start, input.end, mode]);
  return excerpt;
}
