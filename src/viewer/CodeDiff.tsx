import { getSingularPatch } from "@pierre/diffs";
import { PatchDiff } from "@pierre/diffs/react";
import { useTheme } from "maui";
import { useStyles } from "purse-styles";
import { toUnifiedDiff } from "../normalizeDiff.js";
import {
  commentedLines,
  hashNumber,
  LineComment,
  lineNumbers,
  useLineComments,
} from "./lineComments.tsx";
import { diffLineText, pierreDiffOptions, pierreShell } from "./pierre.ts";
import { renderDiffStat } from "./ChangesCard.tsx";

export function CodeDiff(props: { source: string; path?: string }) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(pierreShell);
  const path = props.path === undefined ? "diff" : props.path;
  const patch = toUnifiedDiff(props.source, path);
  const disableFileHeader = props.path === undefined;
  const comments = useLineComments(
    `fence:${hashNumber(props.source).toString(36)}`,
  );

  return (
    <div className={shell} data-file-path={path} data-diffmap-kind="diff">
      <PatchDiff
        patch={patch}
        disableWorkerPool
        renderHeaderMetadata={renderDiffStat}
        lineAnnotations={comments.diffAnnotations(path)}
        renderAnnotation={(annotation) => (
          <LineComment id={annotation.metadata} />
        )}
        options={{
          ...pierreDiffOptions({
            themeType: resolvedTheme,
            disableFileHeader,
          }),
          enableGutterUtility: true,
          onGutterUtilityClick: (range) => {
            const { side = "additions", start, end } = commentedLines(range);
            const diff = getSingularPatch(patch);
            comments.start({
              path,
              side,
              start,
              end,
              lineOffset: 0,
              lines: lineNumbers(start, end).flatMap(
                (line) => diffLineText(diff, side, line) ?? [],
              ),
              context: "diff in the document",
            });
          },
        }}
      />
    </div>
  );
}
