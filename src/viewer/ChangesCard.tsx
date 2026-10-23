import {
  backgroundColor,
  borderColor,
  colors,
  Css,
  File,
  FileCode,
  FileText,
  focusRing,
  GitBranch,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { FileDiffMetadata } from "@pierre/diffs";
import type { SourceAnnotation, SourceNavigation } from "../annotations.js";
import {
  isCommitRev,
  shortRev,
  type ChangedFile,
  type Changes,
  type Rev,
} from "../changes.js";
import { codeFontFamily } from "../codeFont.js";
import { useChanges } from "./changesSource.ts";
import { pierreShell } from "./pierre.js";

/** A phase's file summary. Review opens every file; a row focuses one. */
export function ChangesCard(props: { rev: Rev } & SourceNavigation) {
  const changes = useChanges(props.rev);
  const shell = useStyles(pierreShell, styles.shell);
  const header = useStyles(styles.header);
  const row = useStyles(styles.row);
  const review = useStyles(styles.review);
  const muted = useStyles(styles.muted);
  const range = useStyles(styles.range);
  const open = (annotation: SourceAnnotation) =>
    props.onSelectAnnotation(annotation);
  const files =
    changes === undefined || changes instanceof Error ? [] : changes.files;
  return (
    <div className={shell} data-diffmap-kind="changes">
      <div className={header}>
        <GitBranch size="sm" />
        <span className={range}>{revLabel(props.rev, changes)}</span>
        {changes === undefined || changes instanceof Error ? (
          <span className={muted}>
            {changes === undefined ? "Loading changes…" : changes.message}
          </span>
        ) : (
          <ChangesSummary changes={changes} />
        )}
        {files.length > 0 && (
          <button
            type="button"
            className={review}
            aria-controls="source-diff-panel"
            onClick={() =>
              open({
                text: "Review",
                references: [{ kind: "changes", rev: props.rev }],
              })
            }
          >
            Review
          </button>
        )}
      </div>
      {files.map((file) => {
        const annotation: SourceAnnotation = {
          text: file.path,
          references: [{ kind: "changes", rev: props.rev, path: file.path }],
        };
        return (
          <button
            key={file.path}
            type="button"
            className={row}
            title={file.path}
            aria-controls="source-diff-panel"
            aria-pressed={
              props.selectedAnnotation?.text === file.path &&
              props.selectedAnnotation.references[0]?.kind === "changes" &&
              props.selectedAnnotation.references[0].path === file.path &&
              props.selectedAnnotation.references[0].rev ===
                annotation.references[0]!.rev
            }
            onClick={() => open(annotation)}
          >
            <FileIcon path={file.path} />
            <span className="name">
              {file.path.split("/").pop()}
              {file.status === "deleted" && (
                <span className={muted}> deleted</span>
              )}
            </span>
            <DiffStat file={file} />
          </button>
        );
      })}
    </div>
  );
}

/** "9 files changed +214 −119" for a whole rev; the card and the Diff panel header share it. */
export function ChangesSummary(props: {
  changes: Changes;
  className?: string;
}) {
  const summary = useStyles(styles.summary);
  const { files, truncated } = props.changes;
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const count = files.length;
  return (
    <span className={`${summary} ${props.className ?? ""}`}>
      <span
        title={
          truncated === true
            ? "GitHub listed only these files. Open the commit on GitHub for the rest."
            : undefined
        }
      >
        {count}
        {truncated === true && "+"} {count === 1 ? "file" : "files"} changed
      </span>
      <DiffStat file={{ additions, deletions, binary: false }} />
    </span>
  );
}

/** Labels the rev as the range picker does: a commit by its title, a range as `<from>…<to>`. */
function revLabel(rev: Rev, changes: Changes | Error | undefined) {
  const single = isCommitRev(rev) && !rev.includes("..");
  if (single && changes !== undefined && !(changes instanceof Error))
    return changes.title;
  return shortRev(rev).replace("..", "…");
}

export function DiffStat(props: {
  file: Pick<ChangedFile, "additions" | "deletions" | "binary">;
}) {
  const stat = useStyles(styles.stat);
  if (props.file.binary) return <span className={stat}>binary</span>;
  return (
    <span className={stat}>
      {props.file.additions > 0 && (
        <span className="added">+{props.file.additions}</span>
      )}
      {props.file.deletions > 0 && (
        <span className="removed">−{props.file.deletions}</span>
      )}
    </span>
  );
}

export function renderDiffStat(fileDiff: FileDiffMetadata) {
  const totals = fileDiff.hunks.reduce(
    (sum, hunk) => ({
      additions: sum.additions + hunk.additionLines,
      deletions: sum.deletions + hunk.deletionLines,
    }),
    { additions: 0, deletions: 0 },
  );
  return <DiffStat file={{ ...totals, binary: false }} />;
}

function FileIcon(props: { path: string }) {
  const extension = props.path.split(".").pop()?.toLowerCase() ?? "";
  if (/^(css|scss|less)$/.test(extension)) return <Css size="sm" />;
  if (/^(md|mdx|txt|rst)$/.test(extension)) return <FileText size="sm" />;
  if (
    /^(c|cc|cpp|cs|go|h|java|jsx?|kt|mjs|cjs|py|rb|rs|sh|swift|tsx?|vue|svelte|json|ya?ml|toml|html)$/.test(
      extension,
    )
  )
    return <FileCode size="sm" />;
  return <File size="sm" />;
}

/** Left inset of the file rows' icons. */
const ROW_INSET = 6;
/** Review's box inset from the card's top and right edges: (36px header − 24px button) / 2. */
const EDGE = 6;
/** Right inset of the stats, which Review's text also ends at. */
const STAT_INSET = 12;

const styles = {
  shell: style(text({ size: "sm", color: "highContrast" }), {
    backgroundColor: backgroundColor.app,
    maxWidth: "100%",
  }),
  // Same insets and gap as the file rows, so the branch icon lines up with the file icons
  // and the range with the names. Review's box sits EDGE from the top and right; its
  // text lines up with the stats.
  header: style({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "36px",
    paddingLeft: `${String(ROW_INSET)}px`,
    paddingRight: `${String(EDGE)}px`,
    "& > svg": { flexShrink: 0, color: colors.gray[11] },
    // Divides the summary from the file rows; a card with no files has no divider.
    "&:not(:last-child)": { borderBottom: `1px solid ${borderColor.border}` },
  }),
  range: style(text({ size: "sm", fontWeight: 500, color: "highContrast" }), {
    flex: "1 1 auto",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  summary: style(text({ size: "sm", color: "lowContrast" }), {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  }),
  stat: style(text({ size: "sm", color: "lowContrast" }), {
    display: "inline-flex",
    gap: "8px",
    flexShrink: 0,
    whiteSpace: "nowrap",
    fontFamily: codeFontFamily,
    fontVariantNumeric: "tabular-nums",
    "& .added": { color: colors.green[11] },
    "& .removed": { color: colors.red[11] },
  }),
  review: style(
    text({ size: "sm", fontWeight: 400, color: "highContrast" }),
    {
      height: "24px",
      padding: `0 ${String(STAT_INSET - EDGE)}px`,
      border: 0,
      borderRadius: "4px",
      background: "transparent",
      cursor: "pointer",
      "&:hover": { backgroundColor: colors.gray[3] },
    },
    focusRing(),
  ),
  row: style(
    {
      paddingLeft: `${String(ROW_INSET)}px`,
      paddingRight: `${String(STAT_INSET)}px`,
      display: "flex",
      alignItems: "center",
      gap: "10px",
      width: "100%",
      minHeight: "32px",
      font: "inherit",
      textAlign: "left",
      color: "inherit",
      background: "transparent",
      border: 0,
      cursor: "pointer",
      "& > svg": { flexShrink: 0, color: colors.gray[11] },
      "& .name": {
        flex: "1 1 auto",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
      "&:hover": { backgroundColor: colors.gray[3] },
      "&[aria-pressed='true'], &[aria-pressed='true']:hover": {
        backgroundColor: colors.blue[3],
      },
    },
    focusRing(),
  ),
  muted: style({ color: colors.gray[11] }),
};
