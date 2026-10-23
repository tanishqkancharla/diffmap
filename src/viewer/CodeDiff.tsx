import { PatchDiff } from "@pierre/diffs/react";
import { useTheme } from "maui";
import { useStyles } from "purse-styles";
import { toUnifiedDiff } from "../normalizeDiff.js";
import { pierreDiffOptions, pierreShell } from "./pierre.ts";
import { renderDiffStat } from "./ChangesCard.tsx";

export function CodeDiff(props: { source: string; path?: string }) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(pierreShell);
  const path = props.path === undefined ? "diff" : props.path;
  const patch = toUnifiedDiff(props.source, path);
  const disableFileHeader = props.path === undefined;

  return (
    <div className={shell} data-file-path={path} data-diffmap-kind="diff">
      <PatchDiff
        patch={patch}
        disableWorkerPool
        renderHeaderMetadata={renderDiffStat}
        options={pierreDiffOptions({
          themeType: resolvedTheme,
          disableFileHeader,
        })}
      />
    </div>
  );
}
