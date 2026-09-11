import { Button, GitDiff, backgroundColor } from "maui";
import { style, useStyles } from "purse-styles";

export function DiffButton(props: { pressed: boolean; onClick?: () => void }) {
  const className = useStyles(pressedClass);
  return (
    <Button
      className={className}
      aria-pressed={props.pressed}
      aria-expanded={props.pressed}
      aria-controls="source-diff-panel"
      onClick={props.onClick}
    >
      <GitDiff size="sm" />
      Diff
    </Button>
  );
}

const pressedClass = style({
  "&[aria-pressed='true']": {
    backgroundColor: backgroundColor.elementActive,
  },
});
