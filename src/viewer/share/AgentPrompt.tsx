import { useState } from "react";
import * as errore from "errore";
import {
  Button,
  Text,
  backgroundColor,
  borderColor,
  flex,
  radius,
  spacing,
} from "maui";
import { Check, Copy } from "maui/icons";
import { style, useStyles } from "purse-styles";

class CopyError extends errore.createTaggedError({
  name: "CopyError",
  message: "Could not copy the prompt",
}) {}

/** Proposed in .diffmap/specs/productdoc-sharing: a prompt the person copies to their agent to recover from an error. */
export function AgentPrompt(props: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  const box = useStyles(styles.box);
  const copy = async () => {
    const result = await navigator.clipboard
      .writeText(props.prompt)
      .catch((cause) => new CopyError({ cause }));
    if (result instanceof Error) {
      console.warn("Could not copy the prompt", result);
      return;
    }
    setCopied(true);
  };
  return (
    <div className={box}>
      <Text size="xs" color="lowContrast">
        Ask your agent
      </Text>
      <Text size="sm" style={{ whiteSpace: "normal", flex: 1 }}>
        “{props.prompt}”
      </Text>
      <Button size="sm" onPress={() => void copy()}>
        {copied ? <Check size="xs" /> : <Copy size="xs" />}
        {copied ? "Copied" : "Copy prompt"}
      </Button>
    </div>
  );
}

const styles = {
  box: style(
    radius.sm,
    flex({ direction: "column", alignItems: "start", gap: 2 }),
    spacing.padding({ all: 4 }),
    {
      backgroundColor: backgroundColor.elementHover,
      border: `1px solid ${borderColor.border}`,
    },
  ),
};
