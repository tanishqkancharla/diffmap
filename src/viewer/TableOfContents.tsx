import { useEffect, useRef, useState } from "react";
import {
  backgroundColor,
  colors,
  focusRing,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { ViewerHeading } from "../parseViewer.js";

type TocItem = ViewerHeading & { children: TocItem[] };

export function TableOfContents(props: { headings: ViewerHeading[] }) {
  const headings = tocHeadings(props.headings);
  const items = nestHeadings(headings);
  const { activeId, setActiveId, navRef } = useActiveHeading(props.headings);
  const navClass = useStyles(styles.nav);
  const listClass = useStyles(styles.list);
  if (items.length === 0) return undefined;

  return (
    <nav
      ref={navRef}
      className={navClass}
      aria-label="Table of contents"
      data-tkstack-kind="toc"
    >
      <TocList
        items={items}
        className={listClass}
        activeId={activeId}
        onSelect={setActiveId}
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

function useActiveHeading(headings: ViewerHeading[]) {
  const [activeId, setActiveId] = useState<string>();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ids = tocHeadings(headings).map((heading) => heading.id);
    const nodes = ids.flatMap((id) => {
      const node = document.getElementById(id);
      return node ? [node] : [];
    });
    if (nodes.length === 0) return;
    const root = navRef.current?.closest("article") ?? undefined;
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
  }, [headings]);

  return { activeId, setActiveId, navRef };
}

const styles = {
  nav: style(radius.xl, shadow.medium, spacing.padding({ x: 2, y: 2 }), {
    width: "max-content",
    maxWidth: "240px",
    minWidth: "160px",
    maxHeight: "calc(100vh - 8rem)",
    overflowY: "auto",
    backgroundColor: backgroundColor.app,
    "@media (max-width: 1100px)": {
      display: "none",
    },
    "&[data-tkstack-kind='toc'] ol": {
      listStyle: "none",
      counterReset: "none",
      margin: 0,
      padding: 0,
    },
    "&[data-tkstack-kind='toc'] ol ol": {
      paddingInlineStart: spacing.value(6),
    },
    "&[data-tkstack-kind='toc'] ol > li::before": {
      content: "none",
    },
    "&[data-tkstack-kind='toc'] a": {
      fontWeight: 400,
      textDecoration: "none",
    },
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
