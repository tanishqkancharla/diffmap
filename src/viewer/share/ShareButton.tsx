import { Button, colors, radius } from "maui";
import { Users } from "maui/icons";
import { style, useStyles } from "purse-styles";

/** Proposed in .diffmap/specs/productdoc-sharing: the header's Share button, whose label says whether the link shows the latest edits. */
export function ShareButton(props: {
  shared: boolean;
  /** Pages changed locally since the version at the link. */
  unpublished: number;
  onPress(): void;
}) {
  const dot = useStyles(styles.dot);
  const behind = props.shared && props.unpublished > 0;
  return (
    <Button variant="quiet" onPress={props.onPress}>
      {behind ? (
        <span className={dot} aria-hidden="true" />
      ) : (
        <Users size="sm" />
      )}
      {!props.shared
        ? "Share"
        : behind
          ? `Shared · ${String(props.unpublished)} to publish`
          : "Shared"}
    </Button>
  );
}

const styles = {
  dot: style(radius.circle, {
    width: 8,
    height: 8,
    backgroundColor: colors.orange[9],
  }),
};
