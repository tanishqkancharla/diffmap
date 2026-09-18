import type { ReactNode } from "react";
import {
  backgroundColor,
  border,
  colors,
  flex,
  flexItem,
  Link,
  P,
  spacing,
  text,
  Thinking,
} from "maui";
import { style, useStyles } from "purse-styles";
import { githubGistUrl } from "./route.ts";

export function GistStatus(props: {
  title: string;
  children: ReactNode;
  gistId?: string;
  gistUrl?: string;
  linkLabel?: string;
}) {
  const shell = useStyles(styles.shell);
  const header = useStyles(styles.header);
  const heading = useStyles(styles.heading);
  const body = useStyles(styles.body);
  const title = useStyles(styles.title);
  const gistUrl =
    props.gistUrl ??
    (props.gistId === undefined ? undefined : githubGistUrl(props.gistId));

  return (
    <div className={shell}>
      <header className={header}>
        <div className={heading}>diffmap</div>
      </header>
      <main className={body}>
        <h1 className={title}>{props.title}</h1>
        {props.children}
        {gistUrl !== undefined && (
          <P>
            <Link href={gistUrl}>
              {props.linkLabel ?? "Open gist on GitHub"}
            </Link>
          </P>
        )}
      </main>
    </div>
  );
}

export function GistLoading(props: { title?: string }) {
  const row = useStyles(styles.loading);
  return (
    <GistStatus title={props.title ?? "Loading gist…"}>
      <div className={row}>
        <Thinking />
      </div>
    </GistStatus>
  );
}

export function GistLanding() {
  const code = useStyles(styles.code);
  return (
    <GistStatus title="diffmap">
      <P>
        A hosted viewer for diffmap walkthroughs. This page fetches a GitHub
        gist or a public repo file in your browser. There is no server holding
        the markdown.
      </P>
      <P>
        Canonical gist URL:{" "}
        <code className={code}>https://diffmap.dev/g/&lt;gistId&gt;</code>.
        Optional file:{" "}
        <code className={code}>/g/&lt;gistId&gt;/&lt;file.md&gt;</code>. GitHub
        spec:{" "}
        <code className={code}>
          https://diffmap.dev/&lt;owner&gt;/&lt;repo&gt;/pull/&lt;n&gt;/&lt;path.md&gt;
        </code>{" "}
        or{" "}
        <code className={code}>
          /&lt;owner&gt;/&lt;repo&gt;/commit/&lt;sha&gt;/&lt;path.md&gt;
        </code>
        . Heading hashes stay in the fragment, same as the local viewer.
      </P>
      <P>
        Share a secret gist (requires <code className={code}>gh</code>
        ):
      </P>
      <P>
        <code className={code}>
          npx @tanishqkancharla/diffmap share path/to.md
        </code>
      </P>
      <P>
        Secret gists are unlisted, not private. Anyone with the id can read
        them. Unauthenticated GitHub API is 60 requests per hour per IP.
      </P>
      <P>
        <Link href="https://github.com/tanishqkancharla/diffmap">
          tanishqkancharla/diffmap
        </Link>
      </P>
    </GistStatus>
  );
}

const styles = {
  shell: style(flex({ direction: "column" }), {
    width: "100%",
    height: "100vh",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: colors.gray[4],
  }),
  header: style(
    flex({ direction: "row", alignItems: "center", justifyContent: "between" }),
    spacing.padding({ x: 6, y: 3 }),
    flexItem({ size: "hug" }),
    border(["bottom"], "border"),
    {
      minWidth: 0,
      backgroundColor: backgroundColor.app,
    },
  ),
  heading: style(text({ size: "md", fontWeight: 600, color: "highContrast" }), {
    minWidth: 0,
  }),
  body: style(spacing.padding({ x: 12, y: 12 }), {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    backgroundColor: backgroundColor.app,
    maxWidth: "72ch",
    width: "100%",
    marginInline: "auto",
  }),
  title: style(text({ size: "xl", fontWeight: 600, color: "highContrast" }), {
    marginBottom: spacing.value(4),
  }),
  loading: style(flex({ direction: "row", alignItems: "center" }), {
    minHeight: spacing.value(12),
  }),
  code: style(text({ size: "sm", color: "highContrast" }), {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  }),
};
