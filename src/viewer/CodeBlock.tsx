import { useEffect, useState, type ReactNode } from "react";
import { getSharedHighlighter } from "@pierre/diffs";
import {
  Button,
  Check,
  codeBlockStyles,
  colors,
  Copy,
  Tooltip,
  useTheme,
} from "maui";
import { style, useStyles } from "purse-styles";
import { codeFontFamily } from "../codeFont.js";
import { lineSymbolMatches, type CodeNote } from "../codeNotes.js";
import { lineNoteDot, NoteText, NoteTokens, type Token } from "./notes.tsx";
import { fenceTitle, pierreShell } from "./pierre.ts";

/** A pseudocode fence with an optional title, highlighted lines, hover notes, and a copy button. */
export function CodeBlock(props: {
  lang: string;
  source: string;
  highlights: number[];
  notes: CodeNote[];
  title: string | undefined;
}) {
  const className = useStyles(codeBlockStyles.root, styles.block);
  const figureClassName = useStyles(pierreShell, styles.figure);
  const titleClassName = useStyles(fenceTitle);
  const copyClassName = useStyles(styles.copy);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
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
    <figure
      className={figureClassName}
      data-wrap={proseLangs.has(props.lang) || undefined}
    >
      {props.title !== undefined && (
        <figcaption className={titleClassName}>{props.title}</figcaption>
      )}
      <pre className={className} data-diffmap-kind="code">
        <code>{rows}</code>
      </pre>
      <Button
        className={copyClassName}
        variant="quiet"
        data-copy=""
        data-copied={copied || undefined}
        size="sm"
        aria-label={copied ? "Copied" : "Copy code"}
        onPress={() => {
          // oxlint-disable-next-line typescript/no-floating-promises -- Press handlers cannot await; the icon only changes once the write succeeds.
          void navigator.clipboard.writeText(props.source).then(
            () => setCopied(true),
            (cause) => console.warn("diffmap copy failed", cause),
          );
        }}
      >
        {copied ? <Check size="sm" /> : <Copy size="sm" />}
      </Button>
    </figure>
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

/** Prose-like fences wrap long lines instead of scrolling. */
const proseLangs = new Set(["text", "txt", "plaintext", "md", "markdown"]);

const styles = {
  // The figure is the card, so the block inside drops its own edge.
  figure: style({
    position: "relative",
    margin: 0,
    "& > pre": {
      boxShadow: "none",
      borderRadius: 0,
      backgroundColor: "transparent",
    },
    // Room for the copy button, which sits in the title row.
    "& > figcaption": { paddingRight: "40px" },
    "&:hover > [data-copy], &:focus-within > [data-copy]": { opacity: 1 },
    "&[data-wrap] > pre > code": { display: "block" },
    "&[data-wrap] .line": { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  }),
  // Hidden until the block is hovered or focused, and while it confirms a copy.
  // Touch screens have no hover, so the button always shows there.
  copy: style({
    position: "absolute",
    top: "6px",
    right: "6px",
    opacity: 0,
    "&[data-copied]": { opacity: 1 },
    "@media (hover: none)": { opacity: 1 },
  }),
  block: style({
    fontFamily: codeFontFamily,
    paddingInline: 0,
    // `:is(pre)` outranks the prose rule that shrinks inline code to 0.875em.
    "&:is(pre) > code": {
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
