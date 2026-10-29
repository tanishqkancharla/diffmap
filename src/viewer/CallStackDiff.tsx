import { colors, focusRing, LARGE_SCALE, text, Tooltip } from "maui";
import { defineVars, style, useStyles } from "purse-styles";
import { codeFontFamily } from "../codeFont.js";
import {
  callStackRow,
  type SourceAnnotation,
  type SourceNavigation,
} from "../annotations.js";
import { lineSymbolMatches, type CodeNote } from "../codeNotes.js";
import { NoteText, NoteTokens } from "./notes.tsx";
import { fenceTitle, pierreShell } from "./pierre.js";

export function CallStackDiff(
  props: {
    lines: SourceAnnotation[];
    highlights: number[];
    notes: CodeNote[];
    title: string | undefined;
  } & SourceNavigation,
) {
  const shell = useStyles(pierreShell, styles.shell);
  const titleClassName = useStyles(fenceTitle);
  const rowClassName = useStyles(styles.row);
  return (
    <figure className={shell} data-diffmap-kind="callstack">
      {props.title !== undefined && (
        <figcaption className={titleClassName}>{props.title}</figcaption>
      )}
      {props.lines.map((line, index) => {
        const { sign, tree, description } = callStackRow(line.text);
        const comment = description.indexOf("#");
        const linked = line.references.length > 0;
        const row = index + 1;
        const lineNote = props.notes.find(
          (note) =>
            note.target.kind === "lines" &&
            note.target.start <= row &&
            row <= note.target.end,
        );
        const matches = lineSymbolMatches(description, props.notes);
        const rowProps = {
          className: rowClassName,
          "data-change": sign,
          "data-highlighted": props.highlights.includes(row) || undefined,
          "data-note":
            lineNote === undefined
              ? undefined
              : lineNote.target.kind === "lines" &&
                  lineNote.target.start === row
                ? "start"
                : "",
          // A native title would show beside the note tooltip.
          title:
            lineNote === undefined && matches.length === 0
              ? description
              : undefined,
        };
        const content = (
          <>
            <span className="diff-sign" aria-hidden="true">
              {sign}
            </span>
            <span className="stack-content">
              <span className="tree-prefix" aria-hidden="true">
                {[...tree].map((branch, i) => (
                  <span key={i} data-branch={branch} />
                ))}
              </span>
              <span className="stack-label">
                <NoteTokens
                  tokens={
                    comment === -1
                      ? [{ content: description }]
                      : [
                          { content: description.slice(0, comment) },
                          {
                            content: description.slice(comment),
                            className: "stack-comment",
                          },
                        ]
                  }
                  matches={matches}
                  focusable={!linked}
                />
              </span>
            </span>
            {line.references.length > 0 && (
              <span className="source-indicator" aria-hidden="true">
                ↗
              </span>
            )}
          </>
        );
        const element = linked ? (
          <button
            key={index}
            type="button"
            {...rowProps}
            aria-pressed={props.selectedAnnotation === line}
            aria-controls="source-diff-panel"
            aria-label={description}
            onClick={() => props.onSelectAnnotation(line)}
          >
            {content}
          </button>
        ) : (
          <div
            key={index}
            {...rowProps}
            tabIndex={lineNote === undefined ? undefined : 0}
          >
            {content}
          </div>
        );
        if (lineNote === undefined) return element;
        return (
          <Tooltip key={index} content={<NoteText text={lineNote.text} />}>
            {element}
          </Tooltip>
        );
      })}
    </figure>
  );
}

const rowSize = defineVars({
  height: { default: "22px", [LARGE_SCALE]: "32px" },
});

const styles = {
  // Sized like Maui's code block, so stacks and code read as one family.
  shell: style(text({ size: "xs", fontWeight: 400, color: "highContrast" }), {
    fontFamily: codeFontFamily,
    margin: 0,
    paddingBlock: "8px",
    overflowX: "hidden",
    maxWidth: "100%",
    // The shell's top padding goes below the title, between it and the rows.
    "& > figcaption": {
      marginTop: "-8px",
      marginBottom: "8px",
    },
  }),
  row: style(
    {
      paddingInline: "12px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      boxSizing: "border-box",
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      overflow: "hidden",
      textAlign: "left",
      font: "inherit",
      lineHeight: "1.6",
      color: "inherit",
      background: "transparent",
      border: 0,
      "&[data-change='+']": { backgroundColor: colors.green[3] },
      "&[data-change='-']": { backgroundColor: colors.red[3] },
      "&[data-highlighted]": {
        backgroundColor: colors.blue[3],
        boxShadow: `inset 3px 0 ${colors.blue[9]}`,
      },
      "&[data-change='+'][data-highlighted]": {
        backgroundColor: colors.green[5],
        boxShadow: `inset 3px 0 ${colors.green[9]}`,
      },
      "&[data-change='-'][data-highlighted]": {
        backgroundColor: colors.red[5],
        boxShadow: `inset 3px 0 ${colors.red[9]}`,
      },
      "&[data-note]": { cursor: "help" },
      // The sign fills the row gutter, so the dot follows the label instead.
      "&[data-note='start'] .stack-label::after": {
        content: '""',
        display: "inline-block",
        width: "5px",
        height: "5px",
        marginLeft: "8px",
        verticalAlign: "middle",
        borderRadius: "50%",
        backgroundColor: colors.blue[9],
      },
      "&[aria-pressed]": { cursor: "pointer" },
      "&[aria-pressed]:hover": { backgroundColor: colors.blue[2] },
      "&[aria-pressed='true'], &[aria-pressed='true']:hover": {
        backgroundColor: colors.blue[3],
        boxShadow: `inset 4px 0 ${colors.blue[9]}`,
      },
      "& .stack-content": {
        display: "flex",
        alignItems: "stretch",
        flex: "1 1 auto",
        minWidth: 0,
        minHeight: rowSize.height,
        overflow: "hidden",
      },
      "& .stack-label": {
        alignSelf: "center",
        flex: "1 1 auto",
        minWidth: 0,
        paddingBlock: "1px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
      "& .stack-comment": { color: colors.gray[11], fontWeight: 400 },
      "& .tree-prefix": { display: "inline-flex", alignSelf: "stretch" },
      "& [data-branch]": {
        position: "relative",
        width: "0.6em",
        flexShrink: 0,
      },
      "& [data-branch='│']::before, & [data-branch='┃']::before, & [data-branch='├']::before, & [data-branch='└']::before":
        {
          content: "''",
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          borderLeft: `1px solid ${colors.gray[9]}`,
        },
      "& [data-branch='└']::before": { bottom: "50%" },
      "& [data-branch='├']::after, & [data-branch='└']::after, & [data-branch='─']::after":
        {
          content: "''",
          position: "absolute",
          left: "50%",
          right: 0,
          top: "50%",
          borderTop: `1px solid ${colors.gray[9]}`,
        },
      "& [data-branch='─']::after": { left: 0 },
      "& .tree-prefix, & .diff-sign": {
        fontFamily: codeFontFamily,
        whiteSpace: "pre",
        flexShrink: 0,
      },
      "& > .diff-sign": { alignSelf: "center" },
      "& > .source-indicator": {
        alignSelf: "center",
        flexShrink: 0,
        marginLeft: "auto",
        color: colors.blue[11],
      },
    },
    focusRing(),
  ),
};
