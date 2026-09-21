import { colors, radius, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import { useViewerMode } from "./viewerMode.ts";

export function HtmlPlaceholder(props: { inline?: boolean }) {
  const inline = props.inline === true;
  const className = useStyles(inline ? styles.inline : styles.block);
  const mode = useViewerMode();
  const copy =
    mode === "gist"
      ? "HTML from this gist is not rendered."
      : "HTML is not rendered on the hosted viewer.";
  if (inline) return <span className={className}>{copy}</span>;
  return (
    <aside className={className} data-diffmap-kind="html-disabled">
      {copy}
    </aside>
  );
}

const styles = {
  block: style(
    radius.md,
    spacing.padding({ all: 4 }),
    text({ size: "sm", color: "lowContrast" }),
    {
      minWidth: 0,
      backgroundColor: colors.gray[3],
    },
  ),
  inline: style(text({ size: "sm", color: "lowContrast" }), {
    backgroundColor: colors.gray[3],
  }),
};
