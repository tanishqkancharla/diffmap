import { backgroundColor, radius, shadow, spacing } from "maui";
import { style, useStyles } from "purse-styles";

export function HtmlBlock(props: { source: string }) {
  const className = useStyles(styles.shell);
  return (
    <div
      className={className}
      data-diffmap-kind="html"
      dangerouslySetInnerHTML={{ __html: props.source }}
    />
  );
}

const styles = {
  shell: style(radius.md, shadow.subtle, spacing.padding({ all: 4 }), {
    minWidth: 0,
    backgroundColor: backgroundColor.element,
  }),
};
