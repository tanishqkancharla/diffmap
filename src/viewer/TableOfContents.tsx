import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import {
  background,
  colors,
  focusRing,
  motionEasing,
  overlayMotion,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { ViewerHeading } from "../parseViewer.js";

type TocItem = ViewerHeading & { children: TocItem[] };

const TOC_LINE_MAX_PX = 12;
const TOC_LINE_MIN_PX = 3;
const TOC_LINE_STEP_PX = 3;
const DWELL_MS = 50;
const LEAVE_MS = 100;
const TOC_TRANSITION_MS = 180;

// Maui's Dialog motion (no-bounce spring in, ease-in out), about 25% faster
// so the menu keeps up with hover.
const cardEnter: Transition = {
  type: "spring",
  visualDuration: 0.15,
  bounce: overlayMotion.dialogEnter.bounce,
};
const cardExit: Transition = {
  duration: 0.09,
  ease: "easeIn",
};
const cardReduced: Transition = {
  duration: overlayMotion.reduced.durationMs / 1000,
  ease: "easeInOut",
};

/** Equal side gutters so the line rail fits and the article column stays centered. */
export const TOC_SIDE_MARGIN_PX = 48;

/**
 * Left gutter width at which the list sits there as-is. Narrower gutters (a
 * small window, or an open Diff panel) collapse it to lines and a hover card.
 */
const TOC_DOCKED_MIN_GUTTER_PX = 220;

export function hasTableOfContents(headings: ViewerHeading[]) {
  return tocHeadings(headings).length > 0;
}

export function tocLineWidth(level: number, shallowestLevel: number) {
  const depth = Math.max(0, level - shallowestLevel);
  return Math.max(TOC_LINE_MIN_PX, TOC_LINE_MAX_PX - depth * TOC_LINE_STEP_PX);
}

export function TableOfContents(props: {
  headings: ViewerHeading[];
  articleRef: RefObject<HTMLElement | null>;
}) {
  const headings = tocHeadings(props.headings);
  const items = nestHeadings(headings);
  const { activeId, setActiveId } = useActiveHeading(
    props.headings,
    props.articleRef,
  );
  const navRef = useRef<HTMLElement>(null);
  const docked = useDocked(navRef);
  const railClass = useStyles(styles.rail);
  const dockedClass = useStyles(styles.docked);
  const listClass = useStyles(styles.list);

  if (items.length === 0) return undefined;

  const list = (
    <TocList
      items={items}
      className={listClass}
      activeId={activeId}
      onSelect={setActiveId}
    />
  );

  return (
    <nav
      ref={navRef}
      id="diffmap-toc"
      className={railClass}
      aria-label="Table of contents"
      data-diffmap-kind="toc"
      data-docked={docked ? "true" : "false"}
    >
      {docked ? (
        <div className={dockedClass} data-diffmap-kind="toc-list">
          {list}
        </div>
      ) : (
        <TocRail headings={headings} activeId={activeId}>
          {list}
        </TocRail>
      )}
    </nav>
  );
}

/** Heading lines that open the list in a floating card on hover. */
function TocRail(props: {
  headings: ViewerHeading[];
  activeId: string | undefined;
  children: ReactNode;
}) {
  const clusterClass = useStyles(styles.cluster);
  const lineClass = useStyles(styles.line);
  const cardClass = useStyles(styles.card);
  const reduceMotion = Boolean(useReducedMotion());
  const [open, setOpen] = useState(false);
  const hoveringRef = useRef(false);
  const dwellTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onPageLeave = () => {
      // Leaving the window must close a movement-opened nav, never open one.
      // A left-edge exit used to land in the dwell zone and spring the drawer.
      hoveringRef.current = false;
      window.clearTimeout(dwellTimer.current);
      window.clearTimeout(closeTimer.current);
      dwellTimer.current = undefined;
      closeTimer.current = undefined;
      setOpen(false);
    };
    document.documentElement.addEventListener("mouseleave", onPageLeave);
    return () => {
      document.documentElement.removeEventListener("mouseleave", onPageLeave);
      window.clearTimeout(dwellTimer.current);
      window.clearTimeout(closeTimer.current);
    };
  }, []);

  const shallowest = props.headings.reduce(
    (min, heading) => Math.min(min, heading.level),
    6,
  );

  return (
    <div
      className={clusterClass}
      data-open={open ? "true" : "false"}
      onPointerEnter={() => {
        hoveringRef.current = true;
        window.clearTimeout(closeTimer.current);
        closeTimer.current = undefined;
        if (open || dwellTimer.current !== undefined) return;
        dwellTimer.current = window.setTimeout(() => {
          dwellTimer.current = undefined;
          if (!hoveringRef.current) return;
          setOpen(true);
        }, DWELL_MS);
      }}
      onPointerLeave={() => {
        hoveringRef.current = false;
        window.clearTimeout(dwellTimer.current);
        dwellTimer.current = undefined;
        window.clearTimeout(closeTimer.current);
        closeTimer.current = window.setTimeout(() => {
          closeTimer.current = undefined;
          if (hoveringRef.current) return;
          setOpen(false);
        }, LEAVE_MS);
      }}
    >
      {props.headings.map((heading) => (
        <span
          key={heading.id}
          className={lineClass}
          data-diffmap-kind="toc-line"
          data-level={heading.level}
          data-current={props.activeId === heading.id ? "true" : "false"}
          style={{ width: tocLineWidth(heading.level, shallowest) }}
        />
      ))}
      <motion.div
        className={cardClass}
        // Motion owns transform, so it also applies the vertical centering.
        style={{ y: "-50%" }}
        initial={false}
        animate={
          open
            ? { opacity: 1, scale: 1 }
            : { opacity: 0, scale: reduceMotion ? 1 : 0.94 }
        }
        transition={reduceMotion ? cardReduced : open ? cardEnter : cardExit}
        data-diffmap-kind="toc-card"
        data-open={open ? "true" : "false"}
        aria-hidden={!open}
        inert={!open}
      >
        {props.children}
      </motion.div>
    </div>
  );
}

function TocList(props: {
  items: TocItem[];
  className: string;
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <ol className={props.className}>
      {props.items.map((item) => (
        <TocEntry
          key={item.id}
          item={item}
          listClass={props.className}
          activeId={props.activeId}
          onSelect={props.onSelect}
        />
      ))}
    </ol>
  );
}

function TocEntry(props: {
  item: TocItem;
  listClass: string;
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const itemClass = useStyles(styles.item);
  const linkClass = useStyles(styles.link);
  const current = props.activeId === props.item.id;
  return (
    <li className={itemClass}>
      <a
        className={linkClass}
        href={`#${props.item.id}`}
        aria-current={current ? "location" : undefined}
        onClick={(event) => {
          const heading = document.getElementById(props.item.id);
          if (!heading) return;
          event.preventDefault();
          props.onSelect(props.item.id);
          heading.scrollIntoView({ behavior: "smooth", block: "start" });
          history.pushState({}, "", `#${props.item.id}`);
        }}
      >
        {props.item.text}
      </a>
      {props.item.children.length > 0 && (
        <TocList
          items={props.item.children}
          className={props.listClass}
          activeId={props.activeId}
          onSelect={props.onSelect}
        />
      )}
    </li>
  );
}

function tocHeadings(headings: ViewerHeading[]) {
  const first = headings[0];
  if (first?.level === 1) return headings.slice(1);
  return headings;
}

function nestHeadings(headings: ViewerHeading[]): TocItem[] {
  const items: TocItem[] = [];
  const stack: TocItem[] = [];
  for (const heading of headings) {
    const item: TocItem = { ...heading, children: [] };
    while (stack.length > 0) {
      const parent = stack[stack.length - 1];
      if (parent === undefined || parent.level < heading.level) break;
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent === undefined) items.push(item);
    else parent.children.push(item);
    stack.push(item);
  }
  return items;
}

/**
 * The nav fills the gutter column in both modes, so its width is the gutter's
 * and does not depend on which mode renders inside it.
 */
function useDocked(navRef: RefObject<HTMLElement | null>) {
  const [docked, setDocked] = useState(false);

  useLayoutEffect(() => {
    const node = navRef.current;
    if (node === null) return;
    const measure = () => {
      if (node.clientWidth === 0) return;
      setDocked(node.clientWidth >= TOC_DOCKED_MIN_GUTTER_PX);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [navRef]);

  return docked;
}

function useActiveHeading(
  headings: ViewerHeading[],
  articleRef: RefObject<HTMLElement | null>,
) {
  const [activeId, setActiveId] = useState<string>();

  useEffect(() => {
    const ids = tocHeadings(headings).map((heading) => heading.id);
    const nodes = ids.flatMap((id) => {
      const node = document.getElementById(id);
      return node ? [node] : [];
    });
    if (nodes.length === 0) return;
    const root = articleRef.current ?? undefined;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const next = ids.find((id) => visible.has(id));
        if (next !== undefined) setActiveId(next);
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [articleRef, headings]);

  return { activeId, setActiveId };
}

const tocListRules = {
  "& ol": {
    listStyle: "none",
    counterReset: "none",
    margin: 0,
    padding: 0,
  },
  "& ol ol": {
    paddingInlineStart: spacing.value(6),
  },
  "& ol > li::before": {
    content: "none",
  },
  "& a": {
    fontWeight: 400,
    textDecoration: "none",
  },
} as const;

const styles = {
  rail: style({
    // Sit in the prose grid's left gutter (column 1). Lines share that outer
    // edge and grow inward. Sticky height keeps them in view, off the
    // scrollbar, and on the article when Diff is open.
    gridColumn: "1",
    gridRow: "1",
    position: "sticky",
    top: 0,
    alignSelf: "start",
    justifySelf: "stretch",
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
    height: "100cqh",
    zIndex: 3,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    pointerEvents: "none",
  }),
  cluster: style(spacing.padding({ top: 4, bottom: 4, left: 2, right: 6 }), {
    position: "relative",
    minWidth: "40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
    pointerEvents: "auto",
    "&[data-open='true'] [data-diffmap-kind='toc-line']": {
      opacity: 0,
    },
  }),
  line: style({
    display: "block",
    height: "1px",
    flexShrink: 0,
    borderRadius: "999px",
    backgroundColor: colors.gray[8],
    opacity: 1,
    transition: `opacity ${String(TOC_TRANSITION_MS)}ms ${motionEasing}`,
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
    },
    "&[data-current='true']": {
      backgroundColor: colors.gray[12],
    },
  }),
  card: style(
    radius.lg,
    shadow.medium,
    background.element,
    spacing.padding({ x: 3, y: 3 }),
    {
      position: "absolute",
      insetInlineStart: 0,
      top: "50%",
      zIndex: 1,
      boxSizing: "border-box",
      width: "min(240px, calc(100cqw - 24px))",
      maxHeight: "min(32rem, calc(100cqh - 24px))",
      overflowX: "hidden",
      overflowY: "auto",
      overscrollBehavior: "contain",
      transformOrigin: "left center",
      pointerEvents: "none",
      "&[data-open='true']": {
        pointerEvents: "auto",
      },
      ...tocListRules,
    },
  ),
  // The same list as the card, laid straight into the gutter: no surface,
  // shadow, or hover-to-open. Stays inside the gutter so it never covers prose.
  docked: style(spacing.padding({ right: 6 }), {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "240px",
    maxHeight: "calc(100cqh - 24px)",
    overflowX: "hidden",
    overflowY: "auto",
    overscrollBehavior: "contain",
    pointerEvents: "auto",
    ...tocListRules,
  }),
  list: style(text({ size: "sm", fontWeight: 400, color: "lowContrast" })),
  item: style({
    "&::before": {
      content: "none",
    },
  }),
  link: style(
    radius.sm,
    spacing.padding({ x: 4, y: 2 }),
    text({ size: "sm", fontWeight: 400, color: "lowContrast" }),
    focusRing(),
    {
      display: "block",
      overflowWrap: "anywhere",
      cursor: "pointer",
      "&:hover": {
        backgroundColor: colors.gray[3],
      },
      "&[aria-current='location']": {
        color: colors.accent[9],
        fontWeight: 500,
        backgroundColor: colors.accent[3],
      },
      "&[aria-current='location']:hover": {
        backgroundColor: colors.accent[4],
      },
    },
  ),
};
