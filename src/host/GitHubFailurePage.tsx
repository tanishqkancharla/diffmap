import type { ReactNode } from "react";
import {
  FileSearch,
  Hourglass,
  Lock,
  P,
  WarningTriangle,
  WifiNoConnection,
} from "maui";
import { RetryButton, StatusLink, StatusPage } from "../viewer/StatusPage.tsx";
import { formatResetTime, type GitHubFailure } from "./githubFailure.ts";

/** A gist or GitHub-hosted spec that GitHub would not hand over. */
export function GitHubFailurePage(props: {
  failure: GitHubFailure;
  /** "gist" or "spec", as the reader calls what they opened. */
  noun: "gist" | "spec";
  /** Where the reader can open the same thing on GitHub. */
  githubUrl: string;
  githubLabel: string;
  /** Explains a not-found in terms of what the link named. */
  notFound: ReactNode;
}) {
  const failure = props.failure;
  const openOnGitHub = (
    <StatusLink href={props.githubUrl}>{props.githubLabel}</StatusLink>
  );
  switch (failure.status) {
    case "not-found":
      return (
        <StatusPage
          tone="neutral"
          icon={FileSearch}
          title={props.noun === "gist" ? "Gist not found" : "Spec not found"}
          actions={openOnGitHub}
        >
          {props.notFound}
        </StatusPage>
      );
    case "rate-limited": {
      const at = formatResetTime(failure.resetAt);
      return (
        <StatusPage
          tone="warning"
          icon={Hourglass}
          title="GitHub needs a break"
          actions={
            <>
              <RetryButton />
              {openOnGitHub}
            </>
          }
        >
          <P>
            diffmap.dev reads {props.noun}s through GitHub, which allows 60
            requests an hour from your network, and they ran out.
            {at === undefined
              ? " Wait a few minutes, then try again."
              : ` The limit resets at ${at}.`}
          </P>
        </StatusPage>
      );
    }
    case "forbidden":
      return (
        <StatusPage
          tone="danger"
          icon={Lock}
          title="GitHub refused this request"
          actions={
            <>
              <RetryButton />
              {openOnGitHub}
            </>
          }
        >
          <P>
            GitHub would not let diffmap.dev read this {props.noun}. It may be
            in a private or restricted repository.
          </P>
        </StatusPage>
      );
    case "offline":
      return (
        <StatusPage
          tone="danger"
          icon={WifiNoConnection}
          title="Couldn't reach GitHub"
          actions={<RetryButton />}
        >
          <P>
            diffmap.dev loads this {props.noun} straight from GitHub. Check your
            connection, then try again.
          </P>
        </StatusPage>
      );
    case "error":
      return (
        <StatusPage
          tone="danger"
          icon={WarningTriangle}
          title={`Couldn't load this ${props.noun}`}
          detail={failure.message}
          actions={
            <>
              <RetryButton />
              {openOnGitHub}
            </>
          }
        >
          <P>GitHub answered, but not with something diffmap can show.</P>
        </StatusPage>
      );
  }
}
