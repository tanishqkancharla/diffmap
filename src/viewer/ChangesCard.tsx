import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  borderColor,
  ChevronRight,
  colors,
  Css,
  File,
  FileCode,
  FileText,
  focusRing,
  GitBranch,
  motionDurationMs,
  motionEasing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { FileDiffMetadata } from "@pierre/diffs";
import type { SourceNavigation, SourceReference } from "../annotations.js";
import {
  isCommitRev,
  orderForReview,
  shortRev,
  type ChangedFile,
  type Changes,
  type Rev,
} from "../changes.js";
import { codeFontFamily } from "../codeFont.js";
import { useChanges } from "./changesSource.ts";
import { pierreShell } from "./pierre.js";

/**
 * A phase's file summary. Review opens every file; a row focuses one. Files
 * the fence lists come first, in its order; the rest fold under a dimmed
 * "N other files" section.
 */
export function ChangesCard(
  props: { rev: Rev; review: string[] } & SourceNavigation,
) {
  const changes = useChanges(props.rev);
  const [showOther, setShowOther] = useState(false);
  const otherId = useId();
  const reducedMotion = useReducedMotion();
  const shell = useStyles(pierreShell, styles.shell);
  const header = useStyles(styles.header);
  const review = useStyles(styles.review);
  const muted = useStyles(styles.muted);
  const range = useStyles(styles.range);
  const toggle = useStyles(styles.row, styles.toggle);
  const files =
    changes === undefined || changes instanceof Error ? [] : changes.files;
  const { reviewed, other } = orderForReview(files, props.review);
  const rowProps = {
    rev: props.rev,
    selectedAnnotation: props.selectedAnnotation,
    onSelectAnnotation: props.onSelectAnnotation,
  };
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
              props.onSelectAnnotation({
                text: "Review",
                references: [{ kind: "changes", rev: props.rev }],
              })
            }
          >
            Review
          </button>
        )}
      </div>
      {reviewed.map((file) => (
        <FileRow key={file.path} file={file} {...rowProps} />
      ))}
      {other.length > 0 && (
        <>
          <button
            type="button"
            className={toggle}
            aria-expanded={showOther}
            aria-controls={otherId}
            onClick={() => setShowOther((shown) => !shown)}
          >
            <ChevronRight size="sm" />
            <span className="name">
              {other.length} other {other.length === 1 ? "file" : "files"}
            </span>
            <DiffStat
              additions={other.reduce((sum, file) => sum + file.additions, 0)}
              deletions={other.reduce((sum, file) => sum + file.deletions, 0)}
              binary={false}
            />
          </button>
          <AnimatePresence initial={false}>
            {showOther && (
              <motion.div
                key="other"
                id={otherId}
                role="group"
                aria-label="Other files"
                style={{ overflow: "hidden" }}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={
                  reducedMotion === true
                    ? { duration: 0 }
                    : { type: "spring", visualDuration: 0.22, bounce: 0 }
                }
              >
                {other.map((file) => (
                  <FileRow key={file.path} file={file} dimmed {...rowProps} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

/** One changed file; selecting it opens that file in the Diff panel. */
function FileRow(
  props: { rev: Rev; file: ChangedFile; dimmed?: boolean } & SourceNavigation,
) {
  const row = useStyles(styles.row);
  const muted = useStyles(styles.muted);
  const { file, rev } = props;
  const reference: SourceReference = { kind: "changes", rev, path: file.path };
  const selected = props.selectedAnnotation?.references[0];
  return (
    <button
      type="button"
      className={row}
      title={file.path}
      data-dimmed={props.dimmed === true}
      aria-controls="source-diff-panel"
      aria-pressed={
        props.selectedAnnotation?.text === file.path &&
        selected?.kind === "changes" &&
        selected.path === file.path &&
        selected.rev === rev
      }
      onClick={() =>
        props.onSelectAnnotation({ text: file.path, references: [reference] })
      }
    >
      <FileIcon path={file.path} />
      <FilePath path={file.path} />
      {file.status === "deleted" && <span className={muted}>deleted</span>}
      <DiffStat {...file} />
    </button>
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
      <DiffStat additions={additions} deletions={deletions} binary={false} />
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

/**
 * A file's name, then its folder in muted text. The folder gives way first and
 * truncates in the middle, keeping its first and last segments: `src/vi…/viewer`.
 */
export function FilePath(props: { path: string }) {
  const className = useStyles(styles.filePath);
  const slash = props.path.lastIndexOf("/");
  const folder = slash < 0 ? "" : props.path.slice(0, slash);
  const split = Math.max(folder.lastIndexOf("/"), 0);
  return (
    <span className={className} title={props.path}>
      <span className="file-name">{props.path.slice(slash + 1)}</span>
      {folder !== "" && (
        <span className="file-folder">
          <span className="head">{folder.slice(0, split)}</span>
          <span className="tail">{folder.slice(split)}</span>
        </span>
      )}
    </span>
  );
}

// Keeps the `stat` class so the "other files" toggle can fade its total.
export function DiffStat(
  props: Pick<ChangedFile, "additions" | "deletions" | "binary">,
) {
  const stat = `${useStyles(styles.stat)} stat`;
  if (props.binary) return <span className={stat}>binary</span>;
  return (
    <span className={stat}>
      {props.additions > 0 && <span className="added">+{props.additions}</span>}
      {props.deletions > 0 && (
        <span className="removed">−{props.deletions}</span>
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
  return <DiffStat {...totals} binary={false} />;
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
  // Only the folder shrinks, head first; the name and the folder's last segment
  // truncate only once they alone are wider than the room they have. (A shrink
  // factor would also shave a fraction of a pixel off them, enough for an ellipsis.)
  filePath: style({
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    flex: "1 1 auto",
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    "& .file-name": {
      flexShrink: 0,
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      fontWeight: 500,
      color: colors.gray[12],
    },
    "& .file-folder": {
      display: "flex",
      minWidth: 0,
      overflow: "hidden",
      color: colors.gray[11],
    },
    "& .head, & .tail": { overflow: "hidden", textOverflow: "ellipsis" },
    "& .head": { minWidth: 0 },
    "& .tail": { flexShrink: 0, maxWidth: "100%" },
    // Room for the ellipsis, so a squeezed folder still reads as `s…/viewer`.
    "& .head:not(:empty)": { minWidth: "2ch" },
    "& .head:not(:empty) + .tail": { maxWidth: "calc(100% - 2ch)" },
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
      // Files outside the review list recede until you point at or pick one.
      "&[data-dimmed='true'] > *": {
        opacity: 0.5,
        transition: `opacity ${String(motionDurationMs)}ms ${motionEasing}`,
      },
      "&[data-dimmed='true']:is(:hover, :focus-visible, [aria-pressed='true']) > *":
        { opacity: 1 },
    },
    focusRing(),
  ),
  // A quiet footer row: the chevron sits in the icon column, so the count lines up with file names.
  toggle: style({
    color: colors.gray[11],
    borderTop: `1px solid ${borderColor.border}`,
    "& > svg": { transition: "transform 150ms ease-out" },
    "&[aria-expanded='true'] > svg": { transform: "rotate(90deg)" },
    // The total stat steps aside once the files show their own.
    "& > .stat": {
      opacity: 0.7,
      transition: `opacity ${String(motionDurationMs)}ms ${motionEasing}`,
    },
    "&[aria-expanded='true'] > .stat": { opacity: 0 },
    "&:hover": { color: colors.gray[12] },
  }),
  muted: style({ color: colors.gray[11] }),
};
