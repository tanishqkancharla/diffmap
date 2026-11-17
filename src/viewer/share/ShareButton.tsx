import { Button, colors, radius } from "maui";
import { Users } from "maui/icons";
import { style, useStyles } from "purse-styles";

export type ShareState = "not-shared" | "shared" | "live";

const labels: Record<ShareState, string> = {
  "not-shared": "Share",
  shared: "Shared",
  live: "Shared · Live",
};

/** Proposed in .diffmap/specs/productdoc-sharing: the header's Share button, whose label says whether the document is shared and live. */
export function ShareButton(props: { state: ShareState; onPress(): void }) {
  const dot = useStyles(styles.dot);
  return (
    <Button variant="quiet" onPress={props.onPress}>
      {props.state === "live" ? (
        <span className={dot} aria-hidden="true" />
      ) : (
        <Users size="sm" />
      )}
      {labels[props.state]}
    </Button>
  );
}

const styles = {
  dot: style(radius.circle, {
    width: 8,
    height: 8,
    backgroundColor: colors.green[9],
  }),
};
