import { backgroundColor, radius, shadow, spacing } from "maui";
import { style, useStyles } from "purse-styles";
import { useThemedHtml } from "./htmlTheme.ts";

export function HtmlBlock(props: { source: string }) {
  const className = useStyles(styles.shell);
  return (
    <div
      className={className}
      data-diffmap-kind="html"
      dangerouslySetInnerHTML={{ __html: useThemedHtml(props.source) }}
    />
  );
}

const styles = {
  shell: style(radius.md, shadow.subtle, spacing.padding({ all: 4 }), {
    minWidth: 0,
    backgroundColor: backgroundColor.element,
  }),
};
