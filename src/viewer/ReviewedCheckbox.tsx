import { checkboxStyles, Tooltip } from "maui";
import { useStyles } from "purse-styles";
import { Checkbox } from "react-aria-components";

/** Maui Checkbox's checkmark. */
const CHECKMARK =
  "M3.788 9A.999.999 0 0 1 3 8.615l-2.288-3a1 1 0 1 1 1.576-1.23l1.5 1.991 3.924-4.991a1 1 0 1 1 1.576 1.23l-4.712 6A.999.999 0 0 1 3.788 9z";

/** A bare Reviewed box, named by its tooltip, for corners and headers too tight for a label. */
export function ReviewedCheckbox(props: {
  isSelected: boolean;
  onChange: (value: boolean) => void;
  isDisabled?: boolean;
  placement?: "top" | "bottom";
}) {
  // Maui's Checkbox takes no aria-label or ref, which a bare box under a Tooltip needs.
  const root = useStyles(checkboxStyles.root);
  const box = useStyles(checkboxStyles.box);
  const check = useStyles(checkboxStyles.check);
  return (
    <Tooltip
      placement={props.placement ?? "bottom"}
      content={props.isSelected ? "Mark as not reviewed" : "Mark as reviewed"}
    >
      <Checkbox
        className={root}
        data-reviewed
        aria-label="Reviewed"
        isSelected={props.isSelected}
        isDisabled={props.isDisabled}
        onChange={props.onChange}
      >
        <span className={box}>
          <svg
            focusable="false"
            aria-hidden="true"
            className={check}
            viewBox="0 0 11 11"
          >
            <path d={CHECKMARK} />
          </svg>
        </span>
      </Checkbox>
    </Tooltip>
  );
}
