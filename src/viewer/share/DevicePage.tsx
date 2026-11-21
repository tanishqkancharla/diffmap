import { useState } from "react";
import {
  Button,
  CheckCircle,
  Close,
  Clock,
  Key,
  P,
  backgroundColor,
  border,
  monospace,
  radius,
  spacing,
  text,
} from "maui";
import { Github, Google } from "maui/icons";
import { style, useStyles } from "purse-styles";
import { StatusPage } from "../StatusPage.tsx";
import { AgentPrompt } from "./AgentPrompt.tsx";
import { ProductdocWordmark } from "./ProductdocWordmark.tsx";
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

const retryPrompt = "Sign me in to productdoc again and finish sharing.";

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
  const code = useStyles(styles.code);
  const wordmark = <ProductdocWordmark />;

  const signIn = async (provider: Provider) => {
    setAccount(await props.api.signIn(provider));
    setPhase("confirm");
  };

  if (props.expired) {
    return (
      <StatusPage
        wordmark={wordmark}
        tone="warning"
        icon={Clock}
        title="This sign-in code expired"
        footer={<AgentPrompt prompt={retryPrompt} />}
      >
        <P>
          Codes last 10 minutes, so sharing stopped without uploading anything.
        </P>
      </StatusPage>
    );
  }
  if (phase === "sign-in") {
    return (
      <StatusPage
        wordmark={wordmark}
        tone="neutral"
        icon={Key}
        title="Sign in to productdoc"
        actions={
          <>
            <Button onPress={() => void signIn("google")}>
              <Google size="sm" />
              Continue with Google
            </Button>
            <Button onPress={() => void signIn("github")}>
              <Github size="sm" />
              Continue with GitHub
            </Button>
          </>
        }
      >
        <P>A terminal is asking to share documents as you.</P>
      </StatusPage>
    );
  }
  if (phase === "confirm") {
    return (
      <StatusPage
        wordmark={wordmark}
        tone="info"
        icon={Key}
        title="Allow this terminal to share as you?"
        actions={
          <>
            <Button
              variant="primary"
              onPress={() =>
                void props.api.approve().then(() => setPhase("approved"))
              }
            >
              Allow
            </Button>
            <Button
              onPress={() =>
                void props.api.deny().then(() => setPhase("denied"))
              }
            >
              Cancel
            </Button>
          </>
        }
      >
        <P>
          Check the code matches the one in your terminal. You’re signed in as{" "}
          {account?.email}.
        </P>
        <div className={code}>{props.code}</div>
      </StatusPage>
    );
  }
  if (phase === "approved") {
    return (
      <StatusPage
        wordmark={wordmark}
        tone="info"
        icon={CheckCircle}
        title="You’re signed in"
      >
        <P>Go back to your terminal. Sharing continues there.</P>
      </StatusPage>
    );
  }
  return (
    <StatusPage
      wordmark={wordmark}
      tone="neutral"
      icon={Close}
      title="Sign-in cancelled"
      footer={<AgentPrompt prompt={retryPrompt} />}
    >
      <P>Nothing was shared. You can close this tab.</P>
    </StatusPage>
  );
}

const styles = {
  code: style(
    monospace,
    radius.md,
    spacing.padding({ y: 4 }),
    text({ size: "xl", fontWeight: 600, color: "highContrast" }),
    border(["top", "bottom", "left", "right"], "border"),
    {
      textAlign: "center",
      letterSpacing: "0.12em",
      backgroundColor: backgroundColor.elementHover,
    },
  ),
};
