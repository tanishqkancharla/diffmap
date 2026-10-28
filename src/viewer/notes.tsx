import type { ReactNode } from "react";
import { Code, colors, focusRing, Tooltip } from "maui";
import { style, useStyles } from "purse-styles";
import type { SymbolMatch } from "../codeNotes.js";

export type Token = {
  content: string;
  color?: string;
  fontStyle?: number;
  className?: string;
};

/** Splits tokens at symbol note boundaries and wraps each match in a tooltip. */
export function NoteTokens(props: {
  tokens: Token[];
  matches: SymbolMatch[];
  /** False inside a button, which cannot contain focusable elements. */
  focusable?: boolean;
}) {
  const { tokens, matches } = props;
  const symbolClassName = useStyles(symbolNoteClass);
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
        <span
          className={symbolClassName}
          tabIndex={props.focusable === false ? undefined : 0}
        >
          {group}
        </span>
      </Tooltip>,
    );
    group = [];
  }
  return <>{out}</>;
}

function TokenSpan(props: { token: Token }) {
  const fontStyle = props.token.fontStyle ?? 0;
  return (
    <span
      className={props.token.className}
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
export function NoteText(props: { text: string }) {
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

const symbolNoteClass = style(focusRing(), {
  borderRadius: "3px",
  cursor: "help",
  textDecorationLine: "underline",
  textDecorationStyle: "dotted",
  textDecorationColor: colors.gray[9],
  textUnderlineOffset: "3px",
  "&:hover": { backgroundColor: colors.blueAlpha[5] },
});

/** A dot in the left gutter of the first row a line note covers. */
export const lineNoteDot = {
  content: '""',
  position: "absolute",
  left: "4px",
  top: "calc(0.5lh - 2.5px)",
  width: "5px",
  height: "5px",
  borderRadius: "50%",
  backgroundColor: colors.blue[9],
} as const;
