import { Button, Text } from "maui";
import { Users } from "maui/icons";

/** Proposed in .diffmap/specs/productdoc-sharing: the header's Share button, with the link's state beside it once shared. */
export function ShareButton(props: {
  state: "not-shared" | "live" | "paused";
  onPress(): void;
}) {
  return (
    <>
      {props.state !== "not-shared" && (
        <Text size="xs" color="lowContrast">
          {props.state === "live" ? "Shared · live" : "Shared · paused"}
        </Text>
      )}
      <Button variant="quiet" onPress={props.onPress}>
        <Users size="sm" />
        Share
      </Button>
    </>
  );
}
