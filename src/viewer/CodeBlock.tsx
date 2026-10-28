import { useEffect, useState, type ReactNode } from "react";
import { getSharedHighlighter } from "@pierre/diffs";
import { codeBlockStyles, colors, Tooltip, useTheme } from "maui";
import { style, useStyles } from "purse-styles";
import { codeFontFamily } from "../codeFont.js";
import { lineSymbolMatches, type CodeNote } from "../codeNotes.js";
import { lineNoteDot, NoteText, NoteTokens, type Token } from "./notes.tsx";

/** A pseudocode fence with highlighted lines and hover notes. */
export function CodeBlock(props: {
  lang: string;
  source: string;
  highlights: number[];
  notes: CodeNote[];
}) {
  const className = useStyles(codeBlockStyles.root, styles.block);
  const lines = useTokenLines(props.source, props.lang);
  const sourceLines = props.source.split("\n");

  const renderLine = (index: number) => (
    <span
      key={index}
      className="line"
      data-highlighted={props.highlights.includes(index + 1) || undefined}
    >
      <NoteTokens
        tokens={lines[index] ?? []}
        matches={lineSymbolMatches(sourceLines[index]!, props.notes)}
      />
    </span>
  );

  const rows: ReactNode[] = [];
  for (let index = 0; index < sourceLines.length;) {
    const note = props.notes.find(
      (candidate) =>
        candidate.target.kind === "lines" &&
        candidate.target.start === index + 1,
    );
    if (note === undefined || note.target.kind !== "lines") {
      rows.push(renderLine(index));
      index++;
      continue;
    }
    const range: ReactNode[] = [];
    for (; index < note.target.end; index++) range.push(renderLine(index));
    rows.push(
      <Tooltip key={`note-${index}`} content={<NoteText text={note.text} />}>
        <span className="line-note" tabIndex={0}>
          {range}
        </span>
      </Tooltip>,
    );
  }

  return (
    <pre className={className} data-diffmap-kind="code">
      <code>{rows}</code>
    </pre>
  );
}

/** Tokens per line from Pierre's highlighter; plain text until it loads or for unknown languages. */
function useTokenLines(source: string, lang: string): Token[][] {
  const { resolvedTheme } = useTheme();
  const [highlighted, setHighlighted] = useState<{
    key: string;
    lines: Token[][];
  }>();
  const key = `${resolvedTheme}\n${lang}\n${source}`;
  useEffect(() => {
    let cancelled = false;
    const theme = `pierre-${resolvedTheme}`;
    const tokenize = async (language: string) => {
      const highlighter = await getSharedHighlighter({
        themes: [theme],
        langs: [language],
      });
      return highlighter.codeToTokens(source, { lang: language, theme }).tokens;
    };
    // oxlint-disable-next-line typescript/no-floating-promises -- React effects cannot await; this request owns the token update.
    void tokenize(lang)
      .catch(() => tokenize("text"))
      .then((lines) => {
        if (!cancelled) setHighlighted({ key, lines });
      })
      .catch((cause) => {
        console.warn("diffmap code highlight failed", cause);
      });
    return () => {
      cancelled = true;
    };
  }, [key, lang, resolvedTheme, source]);
  if (highlighted?.key === key) return highlighted.lines;
  return source.split("\n").map((line) => [{ content: line }]);
}

const styles = {
  block: style({
    fontFamily: codeFontFamily,
    paddingInline: 0,
    "& > code": {
      display: "inline-block",
      verticalAlign: "top",
      minWidth: "100%",
      font: "inherit",
    },
    "& .line": {
      display: "block",
      minHeight: "1lh",
      paddingInline: "12px",
    },
    "& .line[data-highlighted]": {
      backgroundColor: colors.blue[3],
      boxShadow: `inset 3px 0 ${colors.blue[9]}`,
    },
    "& .line-note": {
      display: "block",
      position: "relative",
      cursor: "help",
      outline: "none",
    },
    "& .line-note::before": lineNoteDot,
    "& .line-note:hover > .line:not([data-highlighted])": {
      backgroundColor: colors.gray[3],
    },
    "& .line-note:focus-visible": {
      boxShadow: `inset 0 0 0 2px ${colors.blue[8]}`,
    },
  }),
};
