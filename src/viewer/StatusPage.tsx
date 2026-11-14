import type { ComponentType, ReactNode } from "react";
import { Link as AriaLink } from "react-aria-components";
import {
  backgroundColor,
  Banner,
  border,
  Button,
  colors,
  FileError,
  flex,
  flexItem,
  H1,
  LoadingScreen,
  radius,
  Refresh,
  spacing,
  text,
  buttonStyles,
  type IconProps,
} from "maui";
import { style, useStyles } from "purse-styles";

export type StatusTone = "neutral" | "info" | "warning" | "danger";

const tonePalette = {
  neutral: colors.gray,
  info: colors.blue,
  warning: colors.amber,
  danger: colors.red,
} as const;

/**
 * A full page that stands in for a spec diffmap could not show: what happened,
 * why, and what the reader can do about it.
 */
export function StatusPage(props: {
  tone: StatusTone;
  icon: ComponentType<IconProps>;
  title: string;
  /** One or two sentences in the reader's terms. */
  children: ReactNode;
  /** The specific problem, such as a parse error, in a Banner under the explanation. */
  detail?: ReactNode;
  detailTitle?: ReactNode;
  actions?: ReactNode;
  /** Shown under the actions, such as the pages a reader can open instead. */
  footer?: ReactNode;
}) {
  const shell = useStyles(styles.shell);
  const header = useStyles(styles.header);
  const wordmark = useStyles(styles.wordmark);
  const body = useStyles(styles.body);
  const column = useStyles(styles.column);
  const badge = useStyles(styles.badge, toneBadge[props.tone]);
  const description = useStyles(styles.description);
  const actions = useStyles(styles.actions);
  const Icon = props.icon;
  return (
    <div className={shell}>
      <header className={header}>
        <div className={wordmark}>diffmap</div>
      </header>
      <main className={body}>
        <div className={column}>
          <div className={badge} aria-hidden="true">
            <Icon size="lg" />
          </div>
          <H1>{props.title}</H1>
          <div className={description}>{props.children}</div>
          {props.detail !== undefined && (
            <Banner
              tone={props.tone}
              layout={props.detailTitle === undefined ? "inline" : "stacked"}
              title={props.detailTitle}
              icon={false}
              role={props.tone === "danger" ? "alert" : "status"}
            >
              {props.detail}
            </Banner>
          )}
          {props.actions !== undefined && (
            <div className={actions}>{props.actions}</div>
          )}
          {props.footer}
        </div>
      </main>
    </div>
  );
}

/** A link styled as a Maui Button, for actions that leave the page. */
export function StatusLink(props: {
  href: string;
  children: ReactNode;
  variant?: "default" | "primary" | "quiet";
}) {
  const className = useStyles(
    buttonStyles.root({ variant: props.variant }),
    styles.link,
  );
  return (
    <AriaLink className={className} href={props.href}>
      {props.children}
    </AriaLink>
  );
}

/** Reloads the page, which retries every request it made. */
export function RetryButton(props: { label?: string }) {
  return (
    <Button variant="primary" onPress={() => window.location.reload()}>
      <Refresh size="sm" />
      {props.label ?? "Try again"}
    </Button>
  );
}

/** The page's own copy for a detail line, such as a file name or path. */
export function StatusCode(props: { children: string }) {
  const className = useStyles(styles.code);
  return <code className={className}>{props.children}</code>;
}

/** A spec page diffmap could not parse, with the parser's message under the file's name. */
export function SpecErrorPage(props: {
  title?: string;
  file: string;
  message: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <StatusPage
      tone="danger"
      icon={FileError}
      title={props.title ?? "This walkthrough has an error"}
      detailTitle={<StatusCode>{props.file}</StatusCode>}
      detail={props.message}
      actions={props.actions}
    >
      {props.children}
    </StatusPage>
  );
}

/** A spec on its way from GitHub or the local server. */
export function StatusLoading(props: { label?: string }) {
  const shell = useStyles(styles.shell);
  const header = useStyles(styles.header);
  const wordmark = useStyles(styles.wordmark);
  const body = useStyles(styles.loadingBody);
  return (
    <div className={shell}>
      <header className={header}>
        <div className={wordmark}>diffmap</div>
      </header>
      <main className={body}>
        <LoadingScreen progressLabel={props.label} />
      </main>
    </div>
  );
}

const toneBadge = Object.fromEntries(
  Object.entries(tonePalette).map(([tone, palette]) => [
    tone,
    style({ backgroundColor: palette[3], color: palette[11] }),
  ]),
) as Record<StatusTone, ReturnType<typeof style>>;

const styles = {
  shell: style(flex({ direction: "column" }), {
    width: "100%",
    height: "100vh",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
  }),
  header: style(
    flex({ direction: "row", alignItems: "center" }),
    spacing.padding({ x: 6, y: 3 }),
    flexItem({ size: "hug" }),
    border(["bottom"], "border"),
    { minWidth: 0, minHeight: "37px" },
  ),
  wordmark: style(text({ size: "md", fontWeight: 600, color: "highContrast" })),
  body: style(spacing.padding({ x: 8 }), {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    paddingTop: "min(16vh, 160px)",
    paddingBottom: spacing.value(16),
  }),
  loadingBody: style(flex({ direction: "column" }), {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
  }),
  column: style(flex({ direction: "column", gap: 6 }), {
    width: "100%",
    maxWidth: "34rem",
    marginInline: "auto",
  }),
  badge: style(
    flex({ direction: "row", alignItems: "center", justifyContent: "center" }),
    radius.lg,
    { width: "40px", height: "40px" },
  ),
  description: style(
    flex({ direction: "column", gap: 4 }),
    text({ size: "md", color: "lowContrast" }),
    { "& p": { color: "inherit" } },
  ),
  actions: style(flex({ direction: "row", alignItems: "center", gap: 4 }), {
    flexWrap: "wrap",
    paddingTop: spacing.value(2),
  }),
  link: style({ textDecoration: "none" }),
  code: style(text({ size: "sm", color: "highContrast", monospace: true }), {
    overflowWrap: "anywhere",
  }),
};
