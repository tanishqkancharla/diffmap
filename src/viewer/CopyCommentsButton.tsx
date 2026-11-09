import { useEffect, useState } from "react";
import { Button, buttonStyles, Check, colors, Copy } from "maui";
import { style, useStyles } from "purse-styles";
import { isMultiPage, useBook } from "./bookNav.tsx";
import {
  commentsKey,
  formatComments,
  loadComments,
  useComments,
} from "./comments.ts";
import { trackViewerEvent } from "./telemetry.ts";

/** Copies every comment as Markdown to paste to an agent, from every page of a book. Hidden until there is one. */
export function CopyCommentsButton(props: {
  title: string;
  source: string | undefined;
}) {
  const { comments } = useComments();
  const book = useBook();
  // Other pages' comments are saved under their own URLs; this page's are live.
  const pages = isMultiPage(book)
    ? book.pages.map((page) => ({
        title: page.title,
        comments:
          page === book.current
            ? comments
            : loadComments(commentsKey(book.href(page))),
      }))
    : undefined;
  const total =
    pages === undefined
      ? comments.length
      : pages.reduce((sum, page) => sum + page.comments.length, 0);
  const [copied, setCopied] = useState(false);
  const count = useStyles(buttonStyles.label, countStyle);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  if (total === 0) return undefined;
  return (
    <Button
      onPress={() => {
        const markdown = formatComments({
          title: props.title,
          source: props.source,
          comments,
          pages,
        });
        // oxlint-disable-next-line typescript/no-floating-promises -- Press handlers cannot await; the label only changes once the write succeeds.
        void navigator.clipboard.writeText(markdown).then(
          () => {
            setCopied(true);
            trackViewerEvent({ event: "comments_copied" });
          },
          (cause) => console.warn("diffmap copy failed", cause),
        );
      }}
    >
      {copied ? <Check size="sm" /> : <Copy size="sm" />}
      {copied ? "Copied" : "Copy comments"}
      <span className={count}>{total}</span>
    </Button>
  );
}

const countStyle = style({
  color: colors.gray[11],
  fontVariantNumeric: "tabular-nums",
});
