import {
  backgroundColor,
  colors,
  flex,
  focusRing,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { useId } from "react";
import type { ViewerHeading } from "../parseViewer.js";

type TocItem = ViewerHeading & { children: TocItem[] };

export function TableOfContents(props: { headings: ViewerHeading[] }) {
  const items = nestHeadings(tocHeadings(props.headings));
  const labelId = useId();
  const navClass = useStyles(styles.nav);
  const labelClass = useStyles(styles.label);
  const listClass = useStyles(styles.list);
  if (items.length === 0) return undefined;

  return (
    <nav className={navClass} aria-labelledby={labelId} data-tkstack-kind="toc">
      <div id={labelId} className={labelClass}>
        Contents
      </div>
      <TocList items={items} className={listClass} />
    </nav>
  );
}

function TocList(props: { items: TocItem[]; className: string }) {
  return (
    <ol className={props.className}>
      {props.items.map((item) => (
        <TocEntry key={item.id} item={item} listClass={props.className} />
      ))}
    </ol>
  );
}

function TocEntry(props: { item: TocItem; listClass: string }) {
  const itemClass = useStyles(styles.item);
  const linkClass = useStyles(styles.link);
  return (
    <li className={itemClass}>
      <a
        className={linkClass}
        href={`#${props.item.id}`}
        onClick={(event) => {
          const heading = document.getElementById(props.item.id);
          if (!heading) return;
          event.preventDefault();
          heading.scrollIntoView({ behavior: "smooth", block: "start" });
          history.pushState({}, "", `#${props.item.id}`);
        }}
      >
        {props.item.text}
      </a>
      {props.item.children.length > 0 && (
        <TocList items={props.item.children} className={props.listClass} />
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

const styles = {
  nav: style(
    flex({ direction: "column", gap: 3 }),
    radius.md,
    shadow.subtle,
    spacing.padding({ x: 6, y: 4 }),
    {
      "&[data-tkstack-kind='toc'] ol": {
        listStyle: "none",
        counterReset: "none",
        margin: 0,
        padding: 0,
      },
      "&[data-tkstack-kind='toc'] ol ol": {
        marginTop: spacing.value(2),
        paddingInlineStart: spacing.value(6),
      },
      "&[data-tkstack-kind='toc'] ol > li::before": {
        content: "none",
      },
      "&[data-tkstack-kind='toc'] a": {
        fontWeight: 400,
        color: colors.gray[12],
        textDecoration: "none",
      },
    },
  ),
  label: style(text({ size: "xs", fontWeight: 500, color: "lowContrast" })),
  list: style(text({ size: "sm", fontWeight: 400, color: "highContrast" })),
  item: style({
    position: "relative",
    "& + &": {
      marginTop: spacing.value(2),
    },
  }),
  link: style(
    radius.sm,
    spacing.padding({ x: 2, y: 1 }),
    text({ size: "sm", fontWeight: 400, color: "highContrast" }),
    focusRing(),
    {
      display: "block",
      marginInline: `-${spacing.value(2)}`,
      cursor: "pointer",
      "&:hover": {
        backgroundColor: backgroundColor.elementHover,
      },
    },
  ),
};
