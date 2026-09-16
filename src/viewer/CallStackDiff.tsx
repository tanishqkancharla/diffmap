import { backgroundColor, colors, focusRing, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import { codeFontFamily } from "../codeFont.js";
import type { SourceAnnotation, SourceNavigation } from "../annotations.js";
import { pierreShell } from "./pierre.js";

export function CallStackDiff(
  props: { lines: SourceAnnotation[] } & SourceNavigation,
) {
  const shell = useStyles(pierreShell, styles.shell);
  const row = useStyles(styles.row);
  return (
    <div className={shell} data-diffmap-kind="callstack">
      {props.lines.map((line, index) => {
        const sign = line.text.startsWith("+")
          ? "+"
          : line.text.startsWith("-")
            ? "-"
            : " ";
        const label = line.text.replace(/^[+ -]/, "");
        const tree = /^[ \t│┃├└─]*/u.exec(label)![0];
        const description = label.slice(tree.length);
        const comment = description.indexOf("#");
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
                {comment === -1 ? description : description.slice(0, comment)}
                {comment !== -1 && (
                  <span className="stack-comment">
                    {description.slice(comment)}
                  </span>
                )}
              </span>
            </span>
            {line.references.length > 0 && (
              <span className="source-indicator" aria-hidden="true">
                ↗
              </span>
            )}
          </>
        );
        if (line.references.length === 0) {
          return (
            <div
              key={index}
              className={row}
              data-change={sign}
              title={description}
            >
              {content}
            </div>
          );
        }
        return (
          <button
            key={index}
            type="button"
            className={row}
            data-change={sign}
            aria-pressed={props.selectedAnnotation === line}
            aria-controls="source-diff-panel"
            title={description}
            aria-label={description}
            onClick={() => props.onSelectAnnotation(line)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  shell: style(
    text({ size: "sm", fontWeight: 500, color: "highContrast" }),
    spacing.padding({ y: 2 }),
    {
      backgroundColor: backgroundColor.app,
      overflowX: "hidden",
      maxWidth: "100%",
    },
  ),
  row: style(
    spacing.padding({ x: 3 }),
    {
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
        minHeight: "28px",
        overflow: "hidden",
      },
      "& .stack-label": {
        flex: "1 1 auto",
        minWidth: 0,
        paddingBlock: "3px",
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
