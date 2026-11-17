import { useState } from "react";
import {
  Banner,
  Button,
  Flex,
  Text,
  backgroundColor,
  borderColor,
  flex,
  monospace,
  radius,
  spacing,
  text,
} from "maui";
import { CheckCircle, Github, Google } from "maui/icons";
import { style, useStyles } from "purse-styles";
import { AgentPrompt } from "./AgentPrompt.tsx";
import type { Account } from "./ShareForm.tsx";

/**
 * Proposed in .diffmap/specs/productdoc-sharing: productdoc.dev/device, where a person approves a sign-in
 * that `product-doc share` started in a terminal. Nothing renders it yet outside its preview stories.
 */

export type Provider = "google" | "github";

export type DeviceApi = {
  signIn(provider: Provider): Promise<Account>;
  approve(): Promise<void>;
  deny(): Promise<void>;
};

type Phase = "sign-in" | "confirm" | "approved" | "denied";

export function DevicePage(props: {
  /** The code the terminal printed, filled in from the link. */
  code: string;
  /** Set when the person is already signed in to productdoc.dev. */
  account: Account | undefined;
  expired: boolean;
  api: DeviceApi;
}) {
  const [account, setAccount] = useState(props.account);
  const [phase, setPhase] = useState<Phase>(
    props.account === undefined ? "sign-in" : "confirm",
  );
  const card = useStyles(styles.card);
  const heading = useStyles(styles.heading);
  const code = useStyles(styles.code);

  const signIn = async (provider: Provider) => {
    setAccount(await props.api.signIn(provider));
    setPhase("confirm");
  };

  return (
    <section className={card} aria-label="Sign in to productdoc">
      {props.expired ? (
        <>
          <h1 className={heading}>This code expired</h1>
          <Text size="sm" color="lowContrast" style={{ whiteSpace: "normal" }}>
            Codes last 10 minutes, so sharing stopped without uploading
            anything.
          </Text>
          <AgentPrompt prompt="Sign me in to productdoc again and finish sharing." />
        </>
      ) : phase === "sign-in" ? (
        <>
          <h1 className={heading}>Sign in to productdoc</h1>
          <Text size="sm" color="lowContrast" style={{ whiteSpace: "normal" }}>
            A terminal is asking to share documents as you.
          </Text>
          <Flex column gap={3}>
            <Button onPress={() => void signIn("google")}>
              <Google size="sm" />
              Continue with Google
            </Button>
            <Button onPress={() => void signIn("github")}>
              <Github size="sm" />
              Continue with GitHub
            </Button>
          </Flex>
        </>
      ) : phase === "confirm" ? (
        <>
          <h1 className={heading}>Allow this terminal to share as you?</h1>
          <Text size="sm" color="lowContrast" style={{ whiteSpace: "normal" }}>
            Check the code matches the one in your terminal.
          </Text>
          <div className={code}>{props.code}</div>
          <Text size="xs" color="lowContrast">
            Signed in as {account?.email}
          </Text>
          <Flex row gap={3} justifyContent="end">
            <Button
              onPress={() =>
                void props.api.deny().then(() => setPhase("denied"))
              }
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onPress={() =>
                void props.api.approve().then(() => setPhase("approved"))
              }
            >
              Allow
            </Button>
          </Flex>
        </>
      ) : phase === "approved" ? (
        <Banner
          tone="success"
          layout="stacked"
          icon={<CheckCircle size="sm" />}
          title="You're signed in"
        >
          Go back to your terminal. Sharing continues there.
        </Banner>
      ) : (
        <>
          <Banner tone="neutral" layout="stacked" title="Sign-in cancelled">
            Nothing was shared. You can close this tab.
          </Banner>
          <AgentPrompt prompt="Sign me in to productdoc again and finish sharing." />
        </>
      )}
    </section>
  );
}

const styles = {
  card: style(
    radius.lg,
    flex({ direction: "column", gap: 6 }),
    spacing.padding({ x: 8, y: 8 }),
    {
      width: "100%",
      maxWidth: 380,
      boxSizing: "border-box",
      border: `1px solid ${borderColor.outline}`,
      backgroundColor: backgroundColor.element,
    },
  ),
  heading: style(text({ size: "lg", fontWeight: 600 }), { margin: 0 }),
  code: style(
    monospace,
    radius.sm,
    spacing.padding({ y: 4 }),
    text({ size: "xl", fontWeight: 600 }),
    {
      textAlign: "center",
      letterSpacing: "0.1em",
      backgroundColor: backgroundColor.elementHover,
      border: `1px solid ${borderColor.border}`,
    },
  ),
};
