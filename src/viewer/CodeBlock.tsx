import { useEffect, useState, type ReactNode } from "react";
import { getSharedHighlighter } from "@pierre/diffs";
import {
  Code,
  codeBlockStyles,
  colors,
  focusRing,
  Tooltip,
  useTheme,
} from "maui";
import { style, useStyles } from "purse-styles";
import { codeFontFamily } from "../codeFont.js";
import { lineSymbolMatches, type CodeNote } from "../codeNotes.js";

type Token = { content: string; color?: string; fontStyle?: number };

/** A pseudocode fence with highlighted lines and hover notes. */
export function CodeBlock(props: {
  lang: string;
  source: string;
  highlights: number[];
  notes: CodeNote[];
}) {
  const className = useStyles(codeBlockStyles.root, styles.block);
  const symbolClassName = useStyles(styles.symbolNote);
  const lines = useTokenLines(props.source, props.lang);
  const sourceLines = props.source.split("\n");

  const renderLine = (index: number) => (
    <span
      key={index}
      className="line"
      data-highlighted={props.highlights.includes(index + 1) || undefined}
    >
      {renderTokens(
        lines[index] ?? [],
        lineSymbolMatches(sourceLines[index]!, props.notes),
        symbolClassName,
      )}
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

/** Splits tokens at symbol note boundaries and wraps each match in a tooltip. */
function renderTokens(
  tokens: Token[],
  matches: ReturnType<typeof lineSymbolMatches>,
  symbolClassName: string,
) {
  const cuts = new Set(matches.flatMap((match) => [match.start, match.end]));
  const pieces: { start: number; token: Token }[] = [];
  let column = 0;
  for (const token of tokens) {
    let start = column;
    for (let at = column + 1; at < column + token.content.length; at++) {
      if (!cuts.has(at)) continue;
      pieces.push({
        start,
        token: {
          ...token,
          content: token.content.slice(start - column, at - column),
        },
      });
      start = at;
    }
    pieces.push({
      start,
      token: { ...token, content: token.content.slice(start - column) },
    });
    column += token.content.length;
  }

  const out: ReactNode[] = [];
  let group: ReactNode[] = [];
  for (const piece of pieces) {
    const span = <TokenSpan key={piece.start} token={piece.token} />;
    const match = matches.find(
      (m) => piece.start >= m.start && piece.start < m.end,
    );
    if (match === undefined) {
      out.push(span);
      continue;
    }
    group.push(span);
    if (piece.start + piece.token.content.length < match.end) continue;
    out.push(
      <Tooltip
        key={`note-${match.start}`}
        content={<NoteText text={match.note.text} />}
      >
        <span className={symbolClassName} tabIndex={0}>
          {group}
        </span>
      </Tooltip>,
    );
    group = [];
  }
  return out;
}

function TokenSpan(props: { token: Token }) {
  const fontStyle = props.token.fontStyle ?? 0;
  return (
    <span
      style={{
        color: props.token.color,
        fontStyle: fontStyle & 1 ? "italic" : undefined,
        fontWeight: fontStyle & 2 ? 500 : undefined,
        textDecoration: fontStyle & 4 ? "underline" : undefined,
      }}
    >
      {props.token.content}
    </span>
  );
}

/** Note text with `backtick` spans as inline code. */
function NoteText(props: { text: string }) {
  return props.text
    .split(/(`[^`]+`)/)
    .map((part, index) =>
      part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
        <Code key={index}>{part.slice(1, -1)}</Code>
      ) : (
        part
      ),
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
    "& .line-note::before": {
      content: '""',
      position: "absolute",
      left: "4px",
      top: "calc(0.5lh - 2.5px)",
      width: "5px",
      height: "5px",
      borderRadius: "50%",
      backgroundColor: colors.blue[9],
    },
    "& .line-note:hover > .line:not([data-highlighted])": {
      backgroundColor: colors.gray[3],
    },
    "& .line-note:focus-visible": {
      boxShadow: `inset 0 0 0 2px ${colors.blue[8]}`,
    },
  }),
  symbolNote: style(focusRing(), {
    borderRadius: "3px",
    cursor: "help",
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
    textDecorationColor: colors.gray[9],
    textUnderlineOffset: "3px",
    "&:hover": { backgroundColor: colors.blueAlpha[5] },
  }),
};
