import { useEffect, useState } from "react";
import { backgroundColor, border, colors, flex, text } from "maui";
import { style, useStyles } from "purse-styles";
import { init } from "md4x/standalone";
import { parseViewerDocument, type ViewerDocument } from "../parseViewer.ts";
import { CodeBlock } from "../viewer/CodeBlock.tsx";
import demoSource from "./demo.md?raw";

export const GITHUB_URL = "https://github.com/tanishqkancharla/diffmap";
export const DOCS_URL = `${GITHUB_URL}#readme`;

let demo: Promise<ViewerDocument | Error> | undefined;

/** The realistic spec the scroll demo shows. */
function loadDemo() {
  demo ??= init().then(() =>
    parseViewerDocument(demoSource, "sessions-in-postgres.md"),
  );
  return demo;
}

export function useDemo() {
  const [loaded, setLoaded] = useState<ViewerDocument | Error>();
  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns this parse.
    void loadDemo().then((result) => {
      if (active) setLoaded(result);
    });
    return () => {
      active = false;
    };
  }, []);
  return loaded;
}

/** The prompt to paste on a branch. */
export function BranchPrompt() {
  return (
    <CodeBlock
      lang="text"
      source="Write a diffmap spec for the changes on this branch. Use github.com/tanishqkancharla/diffmap"
      highlights={[]}
      notes={[]}
      title={undefined}
    />
  );
}

/** The folded-map favicon: a green panel, a cream panel, and a red panel. */
export function Logo(props: { size?: number }) {
  const size = props.size ?? 20;
  return (
    <svg
      width={size}
      height={size}
      viewBox="4 -8 108 108"
      strokeWidth={5}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 22 41 10v58L8 80z" fill="#b5e3cc" stroke="#5fae8a" />
      <path d="M41 10l34 12v58L41 68z" fill="#fbf7ef" stroke="#d9cdb4" />
      <path d="M75 22l33-12v58L75 80z" fill="#f7a99c" stroke="#e2725f" />
    </svg>
  );
}

/** GitHub's own mark, filled in the link's color. */
function GitHubMark() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function Nav() {
  const nav = useStyles(styles.nav);
  const inner = useStyles(styles.navInner);
  const brand = useStyles(styles.brand);
  const links = useStyles(styles.navLinks);
  const link = useStyles(styles.navLink);
  return (
    <nav className={nav}>
      <div className={inner}>
        <a className={brand} href="#top">
          <Logo />
          diffmap
        </a>
        <div className={links}>
          <a className={link} href={DOCS_URL}>
            Docs
          </a>
          <a className={link} href={`${GITHUB_URL}/blob/main/fixtures`}>
            Examples
          </a>
          <a className={link} href={GITHUB_URL}>
            <GitHubMark />
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}

/** “Review the ~~line diff~~ design.” — the headline drawn like a diagram diff. */
export function DiffHeadline(props: {
  before: string;
  removed: string;
  added: string;
  after?: string;
  align?: "center" | "start";
}) {
  const headline = useStyles(
    styles.headline,
    props.align === "start" ? undefined : styles.centered,
  );
  const removed = useStyles(styles.removed);
  const added = useStyles(styles.added);
  return (
    <h1 className={headline}>
      {props.before} <del className={removed}>{props.removed}</del>{" "}
      <ins className={added}>{props.added}</ins>
      {props.after}
    </h1>
  );
}

export const PAGE_WIDTH = "1180px";
/** Wide enough for the one-line prompt and its Copy button. */
export const PROMPT_WIDTH = "900px";

export const styles = {
  page: style({
    minHeight: "100vh",
    backgroundColor: backgroundColor.app,
    color: colors.gray[12],
  }),
  container: style({
    width: "100%",
    maxWidth: PAGE_WIDTH,
    marginInline: "auto",
    paddingInline: "24px",
    boxSizing: "border-box",
  }),
  nav: style(border(["bottom"], "border"), {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: `color-mix(in oklch, ${backgroundColor.app} 85%, transparent)`,
    backdropFilter: "blur(12px)",
  }),
  navInner: style(
    flex({ direction: "row", alignItems: "center", justifyContent: "between" }),
    {
      maxWidth: PAGE_WIDTH,
      marginInline: "auto",
      paddingInline: "24px",
      height: "52px",
      gap: "16px",
    },
  ),
  brand: style(
    flex({ direction: "row", alignItems: "center", gap: 3 }),
    text({ size: "md", fontWeight: 600, color: "highContrast" }),
    { textDecoration: "none" },
  ),
  navLinks: style(flex({ direction: "row", alignItems: "center", gap: 12 }), {
    "@media (max-width: 480px)": { gap: "16px" },
  }),
  navLink: style(
    flex({ direction: "row", alignItems: "center", gap: 2 }),
    text({ size: "sm", color: "lowContrast" }),
    {
      textDecoration: "none",
      "&:hover": { color: colors.gray[12] },
    },
  ),
  headline: style({
    margin: 0,
    fontSize: "clamp(38px, 6vw, 64px)",
    lineHeight: 1.04,
    letterSpacing: "-0.035em",
    fontWeight: 650,
    color: colors.gray[12],
    textWrap: "balance",
  }),
  centered: style({ textAlign: "center" }),
  removed: style({
    color: colors.red[11],
    textDecorationLine: "line-through",
    textDecorationThickness: "0.06em",
    textDecorationColor: colors.red[9],
    whiteSpace: "nowrap",
    backgroundColor: colors.redAlpha[3],
    borderRadius: "6px",
    paddingInline: "0.12em",
  }),
  added: style({
    color: colors.green[11],
    textDecoration: "none",
    whiteSpace: "nowrap",
    backgroundColor: colors.greenAlpha[3],
    borderRadius: "6px",
    paddingInline: "0.12em",
  }),
  lede: style({
    margin: 0,
    fontSize: "clamp(17px, 2vw, 20px)",
    lineHeight: 1.5,
    color: colors.gray[11],
    textWrap: "pretty",
  }),
  label: style(text({ size: "xs", fontWeight: 500, color: "lowContrast" }), {
    margin: 0,
  }),
};
