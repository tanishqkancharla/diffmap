import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Button,
  backgroundColor,
  border,
  colors,
  flex,
  Github,
  shadow,
  spacing,
  text,
  Close,
} from "maui";
import { style, useStyles } from "purse-styles";
import { init } from "md4x/standalone";
import { referenceLabel, type SourceAnnotation } from "../annotations.ts";
import type { Fence as FenceModel } from "../parseFence.ts";
import {
  parseViewerDocument,
  type ViewerDocument,
  type ViewerNode,
} from "../parseViewer.ts";
import { Fence } from "../viewer/Fence.tsx";
import {
  SourceDiffPanel,
  type SourceSelection,
} from "../viewer/SourceDiffPanel.tsx";
import homeSource from "../host/home.md?raw";
import demoSource from "./demo.md?raw";
import { SESSION_STORE_REV } from "../host/sessionStorePr.ts";

/** The example pull request every diagram on the page explains. */
export const SPEC_REV = SESSION_STORE_REV;
const REVIEW = [
  "src/sessions/store.ts",
  "src/middleware/requireSession.ts",
  "src/routes/login.ts",
  "migrations/0004_sessions.sql",
];

export const GITHUB_URL = "https://github.com/tanishqkancharla/diffmap";
export const DOCS_URL = `${GITHUB_URL}#readme`;

/** The current homepage's examples, by role, so the prototype stays in sync with home.md. */
export type SpecViews = {
  planPrompt: FenceModel;
  branchPrompt: FenceModel;
  install: FenceModel;
  services: FenceModel;
  mermaid: FenceModel;
  callstack: FenceModel;
  changes: FenceModel;
  loginStack: FenceModel;
  share: FenceModel;
  /** The realistic spec the scroll demo shows. */
  demo: ViewerDocument;
};

let views: Promise<SpecViews | Error> | undefined;

function loadViews() {
  views ??= init().then(() => {
    const parsed = parseViewerDocument(homeSource, "home.md");
    if (parsed instanceof Error) return parsed;
    const demo = parseViewerDocument(demoSource, "sessions-in-postgres.md");
    if (demo instanceof Error) return demo;
    const fences: FenceModel[] = [];
    const walk = (nodes: ViewerNode[]) => {
      for (const node of nodes) {
        if (node.type === "view") fences.push(node.fence);
        else if (node.type === "element") walk(node.children);
      }
    };
    walk(parsed.nodes);
    const [planPrompt, branchPrompt, install, services, mermaid, callstack] =
      fences;
    const [changes, loginStack, share] = fences.slice(6);
    return {
      planPrompt: planPrompt!,
      branchPrompt: branchPrompt!,
      install: install!,
      services: services!,
      mermaid: mermaid!,
      callstack: callstack!,
      changes: changes!,
      loginStack: loginStack!,
      share: share!,
      demo,
    };
  });
  return views;
}

export function useSpecViews() {
  const [loaded, setLoaded] = useState<SpecViews | Error>();
  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns this parse.
    void loadViews().then((result) => {
      if (active) setLoaded(result);
    });
    return () => {
      active = false;
    };
  }, []);
  return loaded;
}

/** Which diagram part the reader clicked, shared by every diagram on the page. */
type CodeNavigation = {
  selection: SourceSelection | undefined;
  select: (selection: SourceSelection) => void;
  clear: () => void;
};

const CodeNavigationContext = createContext<CodeNavigation>({
  selection: undefined,
  select: () => {},
  clear: () => {},
});

export function CodeNavigationProvider(props: { children: ReactNode }) {
  const [selection, setSelection] = useState<SourceSelection>();
  return (
    <CodeNavigationContext.Provider
      value={{
        selection,
        select: setSelection,
        clear: () => setSelection(undefined),
      }}
    >
      {props.children}
    </CodeNavigationContext.Provider>
  );
}

export function useCodeNavigation() {
  return useContext(CodeNavigationContext);
}

/** A real diffmap view; clicking a linked part opens its code. */
export function SpecFence(props: { fence: FenceModel }) {
  const navigation = useCodeNavigation();
  return (
    <Fence
      fence={props.fence}
      selectedAnnotation={navigation.selection?.annotation}
      onSelectAnnotation={(annotation: SourceAnnotation) =>
        navigation.select({ annotation, reference: annotation.references[0]! })
      }
    />
  );
}

/** The viewer's Diff panel, showing the example pull request or the clicked reference. */
export function CodePanel(props: { linked?: boolean }) {
  const navigation = useCodeNavigation();
  const className = useStyles(styles.codePanel);
  const selection = props.linked === false ? undefined : navigation.selection;
  return (
    <div className={className}>
      <SourceDiffPanel
        rev={selection?.reference.rev ?? SPEC_REV}
        review={REVIEW}
        selection={selection}
        onSelect={navigation.select}
        onClose={navigation.clear}
      />
    </div>
  );
}

/** Slides in from the right when a diagram part is clicked, like the viewer's Diff panel. */
export function CodeDrawer() {
  const navigation = useCodeNavigation();
  const drawer = useStyles(styles.drawer);
  const bar = useStyles(styles.drawerBar);
  const label = useStyles(styles.drawerLabel);
  if (navigation.selection === undefined) return undefined;
  return (
    <aside className={drawer} aria-label="Linked code">
      <div className={bar}>
        <span className={label}>
          Linked code · {referenceLabel(navigation.selection.reference)}
        </span>
        <Button
          variant="quiet"
          size="sm"
          aria-label="Close code"
          onPress={navigation.clear}
        >
          <Close size="sm" />
        </Button>
      </div>
      <CodePanel />
    </aside>
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
            <Github size="sm" />
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

export function Eyebrow(props: { children: ReactNode }) {
  const className = useStyles(styles.eyebrow);
  return <div className={className}>{props.children}</div>;
}

export function Footer() {
  const footer = useStyles(styles.footer);
  const inner = useStyles(styles.footerInner);
  const brand = useStyles(styles.brand);
  const link = useStyles(styles.navLink);
  return (
    <footer className={footer}>
      <div className={inner}>
        <span className={brand}>
          <Logo size={16} />
          diffmap
        </span>
        <span>Open source · MIT · Specs run on your machine</span>
        <a className={link} href={GITHUB_URL}>
          GitHub
        </a>
      </div>
    </footer>
  );
}

export const PAGE_WIDTH = "1180px";
export const TEXT_WIDTH = "640px";
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
    },
  ),
  brand: style(
    flex({ direction: "row", alignItems: "center", gap: 3 }),
    text({ size: "md", fontWeight: 600, color: "highContrast" }),
    { textDecoration: "none" },
  ),
  navLinks: style(flex({ direction: "row", alignItems: "center", gap: 12 })),
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
  h2: style({
    margin: 0,
    fontSize: "clamp(26px, 3.4vw, 36px)",
    lineHeight: 1.12,
    letterSpacing: "-0.025em",
    fontWeight: 650,
    color: colors.gray[12],
    textWrap: "balance",
  }),
  h3: style(text({ size: "lg", fontWeight: 600, color: "highContrast" }), {
    margin: 0,
  }),
  body: style({
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.6,
    color: colors.gray[11],
    textWrap: "pretty",
  }),
  eyebrow: style(text({ size: "xs", fontWeight: 500, monospace: true }), {
    color: colors.accent[11],
    letterSpacing: "0.02em",
  }),
  label: style(text({ size: "xs", fontWeight: 500, color: "lowContrast" }), {
    margin: 0,
  }),
  codePanel: style({
    display: "grid",
    gridTemplateAreas: '"diff"',
    gridTemplateRows: "minmax(0, 1fr)",
    gridTemplateColumns: "minmax(0, 1fr)",
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    // The viewer's panel draws a left border for its split; the frames here draw their own.
    "& > *": { borderLeft: "none" },
  }),
  drawer: style(shadow.strong, flex({ direction: "column" }), {
    position: "fixed",
    top: "64px",
    right: "12px",
    bottom: "12px",
    width: "min(680px, calc(100vw - 24px))",
    zIndex: 20,
    borderRadius: "10px",
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
  }),
  drawerBar: style(
    flex({ direction: "row", alignItems: "center", justifyContent: "between" }),
    spacing.padding({ x: 6, y: 2 }),
    border(["bottom"], "border"),
    { flexShrink: 0, backgroundColor: colors.gray[2] },
  ),
  drawerLabel: style(
    text({ size: "xs", fontWeight: 500, color: "lowContrast" }),
    {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  ),
  footer: style(border(["top"], "border"), {
    marginTop: "96px",
  }),
  footerInner: style(
    flex({
      direction: "row",
      alignItems: "center",
      justifyContent: "between",
      gap: 8,
    }),
    text({ size: "sm", color: "lowContrast" }),
    {
      maxWidth: PAGE_WIDTH,
      marginInline: "auto",
      paddingInline: "24px",
      height: "72px",
      flexWrap: "wrap",
    },
  ),
};
