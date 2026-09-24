import { useEffect, useRef, useState, type RefObject } from "react";
import {
  background,
  colors,
  focusRing,
  motionEasing,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { ViewerHeading } from "../parseViewer.js";

type TocItem = ViewerHeading & { children: TocItem[] };

const TOC_LINE_MAX_PX = 24;
const TOC_LINE_MIN_PX = 8;
const TOC_LINE_STEP_PX = 6;
const DWELL_MS = 50;
const LEAVE_MS = 100;
const TOC_TRANSITION_MS = 220;
const TOC_MOTION = `opacity ${String(TOC_TRANSITION_MS)}ms ${motionEasing}, transform ${String(TOC_TRANSITION_MS)}ms ${motionEasing}`;

/** Equal side gutters so the line rail fits and the article column stays centered. */
export const TOC_SIDE_MARGIN_PX = 48;

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
  open: boolean;
  onDwellOpen: () => void;
  onDwellClose: () => void;
}) {
  const headings = tocHeadings(props.headings);
  const items = nestHeadings(headings);
  const { activeId, setActiveId } = useActiveHeading(
    props.headings,
    props.articleRef,
  );
  const railClass = useStyles(styles.rail);
  const clusterClass = useStyles(styles.cluster);
  const lineClass = useStyles(styles.line);
  const cardClass = useStyles(styles.card);
  const listClass = useStyles(styles.list);
  const hoveringRef = useRef(false);
  const dwellTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const onDwellOpen = props.onDwellOpen;
  const onDwellClose = props.onDwellClose;

  useEffect(() => {
    const onPageLeave = () => {
      // Leaving the window must close a movement-opened nav, never open one.
      // A left-edge exit used to land in the dwell zone and spring the drawer.
      hoveringRef.current = false;
      window.clearTimeout(dwellTimer.current);
      window.clearTimeout(closeTimer.current);
      dwellTimer.current = undefined;
      closeTimer.current = undefined;
      onDwellClose();
    };
    document.documentElement.addEventListener("mouseleave", onPageLeave);
    return () => {
      document.documentElement.removeEventListener("mouseleave", onPageLeave);
      window.clearTimeout(dwellTimer.current);
      window.clearTimeout(closeTimer.current);
    };
  }, [onDwellClose]);

  if (items.length === 0) return undefined;

  const shallowest = headings.reduce(
    (min, heading) => Math.min(min, heading.level),
    6,
  );

  return (
    <nav
      id="diffmap-toc"
      className={railClass}
      aria-label="Table of contents"
      data-diffmap-kind="toc"
      data-open={props.open ? "true" : "false"}
    >
      <div
        className={clusterClass}
        data-open={props.open ? "true" : "false"}
        onPointerEnter={() => {
          hoveringRef.current = true;
          window.clearTimeout(closeTimer.current);
          closeTimer.current = undefined;
          if (props.open || dwellTimer.current !== undefined) return;
          dwellTimer.current = window.setTimeout(() => {
            dwellTimer.current = undefined;
            if (!hoveringRef.current) return;
            onDwellOpen();
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
            onDwellClose();
          }, LEAVE_MS);
        }}
      >
        {headings.map((heading) => (
          <span
            key={heading.id}
            className={lineClass}
            data-diffmap-kind="toc-line"
            data-level={heading.level}
            data-current={activeId === heading.id ? "true" : "false"}
            style={{ width: tocLineWidth(heading.level, shallowest) }}
          />
        ))}
        <div
          className={cardClass}
          data-diffmap-kind="toc-card"
          data-open={props.open ? "true" : "false"}
          aria-hidden={!props.open}
          inert={!props.open}
        >
          <TocList
            items={items}
            className={listClass}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
            }}
          />
        </div>
      </div>
    </nav>
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
  "&[data-diffmap-kind='toc-card'] ol": {
    listStyle: "none",
    counterReset: "none",
    margin: 0,
    padding: 0,
  },
  "&[data-diffmap-kind='toc-card'] ol ol": {
    paddingInlineStart: spacing.value(6),
  },
  "&[data-diffmap-kind='toc-card'] ol > li::before": {
    content: "none",
  },
  "&[data-diffmap-kind='toc-card'] a": {
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
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: spacing.value(6),
    pointerEvents: "auto",
    "&[data-open='true'] [data-diffmap-kind='toc-line']": {
      opacity: 0,
    },
  }),
  line: style({
    display: "block",
    height: "2px",
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
      opacity: 0,
      pointerEvents: "none",
      transform: "translateY(-50%) translateX(-6px) scale(0.98)",
      transition: TOC_MOTION,
      "@media (prefers-reduced-motion: reduce)": {
        transition: "none",
      },
      "&[data-open='true']": {
        opacity: 1,
        pointerEvents: "auto",
        transform: "translateY(-50%) translateX(0px) scale(1)",
      },
      ...tocListRules,
    },
  ),
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
