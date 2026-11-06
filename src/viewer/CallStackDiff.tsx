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
import { useTokenLines } from "./CodeBlock.tsx";

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
  const scrollClassName = useStyles(styles.scroll);
  const rowsClassName = useStyles(styles.rows);
  const rows = props.lines.map((line) => callStackRow(line.text));
  const highlighted = useTokenLines(
    rows.map((row) => row.description).join("\n"),
    "typescript",
  );
  return (
    <figure className={shell} data-diffmap-kind="callstack">
      {props.title !== undefined && (
        <figcaption className={titleClassName}>{props.title}</figcaption>
      )}
      <div
        className={scrollClassName}
        tabIndex={0}
        role="region"
        aria-label={props.title ?? "Call stack"}
      >
        <div className={rowsClassName}>
          {props.lines.map((line, index) => {
            const { sign, tree, description } = rows[index]!;
            const prefix = tree.replaceAll("\t", "    ");
            const branch = prefix.search(/[├└]/u);
            const depth =
              branch === -1
                ? Math.ceil(prefix.length / 4)
                : Math.floor(branch / 4) + 1;
            const comment = description.indexOf("#");
            let column = 0;
            const tokens = (
              highlighted[index] ?? [{ content: description }]
            ).flatMap((token) => {
              const start = column;
              column += token.content.length;
              if (comment === -1 || column <= comment) return [token];
              if (start >= comment)
                return [{ ...token, color: colors.gray[11] }];
              return [
                { ...token, content: token.content.slice(0, comment - start) },
                {
                  ...token,
                  content: token.content.slice(comment - start),
                  color: colors.gray[11],
                },
              ];
            });
            const linked = line.references.length > 0;
            const row = index + 1;
            const lineNote = props.notes.find(
              (note) =>
                note.target.kind === "lines" &&
                note.target.start <= row &&
                row <= note.target.end,
            );
            const matches = lineSymbolMatches(description, props.notes, row);
            const rowProps = {
              className: rowClassName,
              "data-change": sign,
              "data-highlighted": props.highlights.includes(row) || undefined,
              "data-note": lineNote === undefined ? undefined : "",
              // A native title would show beside the note tooltip.
              title:
                lineNote === undefined && matches.length === 0
                  ? description
                  : undefined,
            };
            const content = (
              <>
                {linked && (
                  <span className="row-indicator" aria-hidden="true" />
                )}
                <span className="stack-content">
                  <span className="stack-hierarchy" aria-hidden="true">
                    {Array.from({ length: depth }, (_, level) => (
                      <span
                        key={level}
                        className="stack-guide"
                        data-elbow={level === depth - 1 || undefined}
                        data-continued={
                          /[│┃├]/u.test(prefix[level * 4] ?? "") || undefined
                        }
                      />
                    ))}
                  </span>
                  <span className="stack-label">
                    <NoteTokens
                      tokens={tokens}
                      matches={matches}
                      focusable={!linked}
                    />
                  </span>
                </span>
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
        </div>
      </div>
    </figure>
  );
}

const rowSize = defineVars({
  height: { default: "22px", [LARGE_SCALE]: "28px" },
});

const styles = {
  shell: style(text({ size: "sm", fontWeight: 400, color: "highContrast" }), {
    fontFamily: codeFontFamily,
    margin: 0,
    overflowX: "hidden",
    maxWidth: "100%",
  }),
  scroll: style(focusRing(), {
    overflowX: "auto",
    maxWidth: "100%",
    paddingBlock: "4px",
  }),
  rows: style({ width: "max-content", minWidth: "100%" }),
  row: style(
    {
      position: "relative",
      paddingInline: "12px",
      paddingBlock: 0,
      display: "flex",
      alignItems: "center",
      gap: "4px",
      boxSizing: "border-box",
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      overflow: "hidden",
      textAlign: "left",
      font: "inherit",
      color: "inherit",
      background: "transparent",
      border: 0,
      "&[data-change='+']": {
        backgroundColor: colors.green[3],
        boxShadow: `inset 3px 0 ${colors.green[9]}`,
      },
      "&[data-change='-']": {
        backgroundColor: colors.red[3],
        boxShadow: `inset 3px 0 ${colors.red[9]}`,
      },
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
      "&[data-note] .stack-label": {
        textDecorationLine: "underline",
        textDecorationStyle: "dotted",
        textDecorationColor: colors.gray[9],
        textUnderlineOffset: "3px",
      },
      "&[aria-pressed]": { cursor: "pointer" },
      "&[aria-pressed]:hover": { backgroundColor: colors.blue[2] },
      "&[aria-pressed='true'], &[aria-pressed='true']:hover": {
        backgroundColor: colors.blue[3],
      },
      "& .stack-content": {
        display: "flex",
        alignItems: "stretch",
        flex: "1 0 auto",
        minWidth: 0,
        minHeight: rowSize.height,
      },
      "& .stack-label": {
        alignSelf: "center",
        flex: "1 0 auto",
        minWidth: 0,
        whiteSpace: "pre",
      },
      "& .stack-hierarchy:not(:empty) + .stack-label": { paddingLeft: "4px" },
      "& .stack-hierarchy": { display: "inline-flex", alignSelf: "stretch" },
      "& .stack-guide": {
        position: "relative",
        width: "16px",
        flexShrink: 0,
      },
      "& .stack-guide[data-continued]::before": {
        content: "''",
        position: "absolute",
        left: "7px",
        insetBlock: 0,
        borderLeft: `1px solid ${colors.gray[9]}`,
      },
      "& .stack-guide[data-elbow]::after": {
        content: "''",
        position: "absolute",
        left: "7px",
        right: 0,
        top: 0,
        bottom: "50%",
        borderLeft: `1px solid ${colors.gray[9]}`,
        borderBottom: `1px solid ${colors.gray[9]}`,
        borderBottomLeftRadius: "5px",
      },
      "& .stack-guide[data-elbow][data-continued]::after": {
        top: "50%",
        bottom: "auto",
        borderLeft: 0,
        borderBottomLeftRadius: 0,
      },
      "& .row-indicator": {
        position: "absolute",
        left: "4px",
        top: "50%",
        transform: "translateY(-50%)",
        width: "4px",
        height: "4px",
        borderRadius: "50%",
        backgroundColor: colors.blue[9],
      },
    },
    focusRing(),
  ),
};
