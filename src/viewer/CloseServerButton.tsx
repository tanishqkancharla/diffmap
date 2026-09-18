import { Button, Close, colors } from "maui";
import { style, useStyles } from "purse-styles";

const closeIcon = style({
  color: colors.red[9],
});

export function CloseServerButton(props: { onClick?: () => void }) {
  const iconClass = useStyles(closeIcon);
  return (
    <Button variant="quiet" onClick={props.onClick}>
      <Close className={iconClass} size="sm" />
      Close server
    </Button>
  );
}
