import {
  Button,
  UnorderedList,
  controlSize,
  iconSizeValues,
  spacing,
} from "maui";
import { style, useStyles } from "purse-styles";

const iconSize = iconSizeValues.sm;

/** Opens the table of contents on narrow screens, where the gutter rail is hidden. */
export function TocButton(props: { expanded: boolean; onClick: () => void }) {
  const className = useStyles(styles.button);
  return (
    <Button
      className={className}
      variant="quiet"
      aria-label="Table of contents"
      aria-haspopup="dialog"
      aria-expanded={props.expanded}
      onClick={props.onClick}
    >
      <UnorderedList size="sm" />
    </Button>
  );
}

const styles = {
  button: style({
    flexShrink: 0,
    // Pulled left so the icon's ink starts at the page's edge: the icon is
    // centered in a button at least the touch target wide, and its bullets
    // start 5 units into its 24-unit viewBox.
    marginInlineStart: `calc((${iconSize} - max(${controlSize.minTarget}, ${iconSize} + 2 * ${spacing.value(3)})) / 2 - ${iconSize} * 5 / 24)`,
    "@media (min-width: 601px)": {
      display: "none",
    },
  }),
};
