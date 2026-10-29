import { Button, UnorderedList } from "maui";
import { style, useStyles } from "purse-styles";

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
    "@media (min-width: 601px)": {
      display: "none",
    },
  }),
};
