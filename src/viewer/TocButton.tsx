import { Button, UnorderedList, backgroundColor } from "maui";
import { style, useStyles } from "purse-styles";

export function TocButton(props: { expanded: boolean; onClick?: () => void }) {
  const className = useStyles(pressedClass);
  return (
    <Button
      id="diffmap-toc-button"
      className={className}
      variant="quiet"
      aria-label="Table of contents"
      aria-pressed={props.expanded}
      aria-expanded={props.expanded}
      aria-controls="diffmap-toc"
      onClick={props.onClick}
    >
      <UnorderedList size="sm" />
    </Button>
  );
}

const pressedClass = style({
  flexShrink: 0,
  "&[aria-pressed='true']": {
    backgroundColor: backgroundColor.elementActive,
  },
});
