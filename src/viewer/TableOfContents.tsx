import { useEffect, useState, type RefObject } from "react";
import { colors, focusRing, radius, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import type { ViewerHeading } from "../parseViewer.js";

type TocItem = ViewerHeading & { children: TocItem[] };

export const TOC_OVERLAY_MIN_WIDTH_PX = 1101;
export const TOC_WIDTH_PX = 240;

export function hasTableOfContents(headings: ViewerHeading[]) {
  return tocHeadings(headings).length > 0;
}

export function TableOfContents(props: {
  headings: ViewerHeading[];
  articleRef: RefObject<HTMLElement | null>;
  layout: "overlay" | "panel";
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const items = nestHeadings(tocHeadings(props.headings));
  const { activeId, setActiveId } = useActiveHeading(
    props.headings,
    props.articleRef,
  );
  const navClass = useStyles(
    props.layout === "panel" ? styles.panel : styles.overlay,
  );
  const listClass = useStyles(styles.list);
  if (items.length === 0) return undefined;
  const collapsed = props.layout === "overlay" && props.collapsed === true;

  return (
    <nav
      id="diffmap-toc"
      className={navClass}
      aria-label="Table of contents"
      data-diffmap-kind="toc"
      data-open={String(!collapsed)}
      aria-hidden={collapsed}
      inert={collapsed}
    >
      <TocList
        items={items}
        className={listClass}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          props.onNavigate?.();
        }}
      />
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
  "&[data-diffmap-kind='toc'] ol": {
    listStyle: "none",
    counterReset: "none",
    margin: 0,
    padding: 0,
  },
  "&[data-diffmap-kind='toc'] ol ol": {
    paddingInlineStart: spacing.value(6),
  },
  "&[data-diffmap-kind='toc'] ol > li::before": {
    content: "none",
  },
  "&[data-diffmap-kind='toc'] a": {
    fontWeight: 400,
    textDecoration: "none",
  },
} as const;

const styles = {
  overlay: style(spacing.padding({ left: 16, right: 6, top: 8, bottom: 8 }), {
    boxSizing: "border-box",
    position: "absolute",
    insetInlineStart: 0,
    top: 0,
    bottom: 0,
    zIndex: 2,
    width: `${TOC_WIDTH_PX}px`,
    height: "fit-content",
    maxHeight: "100%",
    marginTop: "auto",
    marginBottom: "auto",
    overflowX: "hidden",
    overflowY: "auto",
    backgroundColor: "transparent",
    pointerEvents: "auto",
    "&[data-open='false']": {
      opacity: 0,
      pointerEvents: "none",
    },
    ...tocListRules,
  }),
  panel: style(spacing.padding({ left: 4, right: 4, top: 8, bottom: 8 }), {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "100%",
    overflowY: "auto",
    backgroundColor: "transparent",
    boxShadow: "none",
    borderRadius: 0,
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
      },
    },
  ),
};
