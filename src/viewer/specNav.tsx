import {
  createContext,
  useContext,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  borderColor,
  colors,
  focusRing,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { linkedPage, type SpecPage } from "../spec.js";

/** A spec the viewer shows one page of, and how its host moves between pages. */
export type SpecNav = {
  title: string;
  pages: SpecPage[];
  current: SpecPage;
  /** The page's URL path, which also names its saved comments. */
  href: (page: SpecPage) => string;
  navigate: (page: SpecPage, hash: string) => void;
};

export const SpecContext = createContext<SpecNav | undefined>(undefined);

export function useSpec() {
  return useContext(SpecContext);
}

/** A spec with more than one page; a one-page spec shows no page navigation. */
export function isMultiPage(spec: SpecNav | undefined): spec is SpecNav {
  return spec !== undefined && spec.pages.length > 1;
}

/** Opens a page in place on a plain click; a modified click opens the page's URL as a browser would. */
export function navigateOnClick(
  event: MouseEvent,
  spec: SpecNav,
  page: SpecPage,
  hash = "",
) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  spec.navigate(page, hash);
}

/** A Markdown link; one to another page of the spec opens that page. */
export function DocumentLink(props: {
  href: string | undefined;
  title: string | undefined;
  className: string | undefined;
  id: string | undefined;
  children: ReactNode;
}) {
  const spec = useSpec();
  const target =
    spec === undefined || props.href === undefined
      ? undefined
      : linkedPage(spec, props.href);
  if (spec === undefined || target === undefined) {
    return <a {...props} />;
  }
  return (
    <a
      {...props}
      href={`${spec.href(target.page)}${target.hash}`}
      onClick={(event) =>
        navigateOnClick(event, spec, target.page, target.hash)
      }
    />
  );
}

/** Links to the previous and next pages, at the end of a page. */
export function PageLinks() {
  const spec = useSpec();
  const nav = useStyles(styles.nav);
  const link = useStyles(styles.link);
  const label = useStyles(styles.label);
  const pageTitle = useStyles(styles.title);
  if (!isMultiPage(spec)) return undefined;
  const index = spec.pages.indexOf(spec.current);
  const previous = spec.pages[index - 1];
  const next = spec.pages[index + 1];
  const item = (page: SpecPage | undefined, direction: "previous" | "next") =>
    page === undefined ? (
      <span />
    ) : (
      <a
        className={link}
        data-direction={direction}
        href={spec.href(page)}
        rel={direction === "previous" ? "prev" : "next"}
        onClick={(event) => navigateOnClick(event, spec, page)}
      >
        <span className={label}>
          {direction === "previous" ? "← Previous" : "Next →"}
        </span>
        <span className={pageTitle}>{page.title}</span>
      </a>
    );
  return (
    <nav className={nav} aria-label="Pages" data-diffmap-kind="page-links">
      {item(previous, "previous")}
      {item(next, "next")}
    </nav>
  );
}

const styles = {
  nav: style({
    marginTop: spacing.value(16),
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: spacing.value(4),
    paddingTop: spacing.value(8),
    borderTop: `1px solid ${borderColor.border}`,
    "@media (max-width: 600px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  }),
  link: style(
    radius.lg,
    shadow.subtle,
    spacing.padding({ x: 6, y: 4 }),
    focusRing(),
    {
      display: "flex",
      flexDirection: "column",
      gap: spacing.value(1),
      minWidth: 0,
      textDecoration: "none",
      "&:hover": { backgroundColor: colors.gray[3] },
      // The last column: beside Previous, or under it on a narrow window.
      "&[data-direction='next']": {
        gridColumn: "-2 / -1",
        alignItems: "flex-end",
        textAlign: "end",
      },
    },
  ),
  label: style(text({ size: "sm", color: "lowContrast" })),
  title: style(text({ size: "md", fontWeight: 500, color: "highContrast" }), {
    overflowWrap: "anywhere",
  }),
};
