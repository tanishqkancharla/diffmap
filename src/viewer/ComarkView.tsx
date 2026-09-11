import { createElement, type ReactNode, useState } from "react";
import {
  Checkbox,
  colors,
  monospace,
  radius,
  spacing,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  type TableAlign,
} from "maui";
import { style, useStyles } from "purse-styles";
import type {
  ViewerDocument,
  ViewerElement,
  ViewerNode,
} from "../parseViewer.js";
import type { SourceNavigation } from "../annotations.js";
import { Fence } from "./Fence.tsx";
import { TableOfContents } from "./TableOfContents.tsx";

const voidTags = new Set(["img", "hr", "br"]);
const headingTags = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

export function ComarkView(
  props: { document: ViewerDocument } & SourceNavigation,
) {
  const headingIndex = firstHeadingIndex(props.document.nodes);
  const before =
    headingIndex === undefined
      ? []
      : props.document.nodes.slice(0, headingIndex + 1);
  const after =
    headingIndex === undefined
      ? props.document.nodes
      : props.document.nodes.slice(headingIndex + 1);
  return (
    <>
      {before.map((node, index) => renderNode(node, index, props))}
      <TableOfContents headings={props.document.headings} />
      {after.map((node, index) =>
        renderNode(node, before.length + index, props),
      )}
    </>
  );
}

function firstHeadingIndex(nodes: ViewerNode[]) {
  const index = nodes.findIndex(
    (node) => node.type === "element" && headingTags.has(node.tag),
  );
  return index === -1 ? undefined : index;
}

function renderNode(
  node: ViewerNode,
  key: number,
  navigation: SourceNavigation,
): ReactNode {
  if (node.type === "text") return node.value;
  if (node.type === "html") {
    if (node.block) {
      return (
        <div key={key} dangerouslySetInnerHTML={{ __html: node.source }} />
      );
    }
    return <span key={key} dangerouslySetInnerHTML={{ __html: node.source }} />;
  }
  if (node.type === "view") {
    return <Fence key={key} fence={node.fence} {...navigation} />;
  }
  return renderElement(node, key, navigation);
}

function renderElement(
  node: ViewerElement,
  key: number,
  navigation: SourceNavigation,
): ReactNode {
  if (node.tag === "table") return renderTable(node, key, navigation);
  const children = node.children.map((child, index) =>
    renderNode(child, index, navigation),
  );
  if (node.tag === "alert") {
    return (
      <blockquote key={key} data-alert={node.attrs.alertType}>
        {children}
      </blockquote>
    );
  }
  if (node.tag === "li" && node.attrs.task === true) {
    return (
      <TaskListItem key={key} node={node}>
        {children}
      </TaskListItem>
    );
  }
  if (node.tag === "code") {
    return <InlineChip key={key}>{children}</InlineChip>;
  }
  if (voidTags.has(node.tag)) {
    return createElement(node.tag, { key, ...domAttrs(node) });
  }
  return createElement(node.tag, { key, ...domAttrs(node) }, children);
}

function tableElements(node: ViewerElement, tag: string): ViewerElement[] {
  return node.children.filter(
    (child): child is ViewerElement =>
      child.type === "element" && child.tag === tag,
  );
}

function tableAlign(node: ViewerElement): TableAlign | undefined {
  if (node.attrs.align === "left") return "start";
  if (node.attrs.align === "right") return "end";
  if (node.attrs.align === "center") return "center";
  return undefined;
}

function renderTable(
  node: ViewerElement,
  key: number,
  navigation: SourceNavigation,
) {
  const headers = tableElements(node, "thead")
    .flatMap((head) => tableElements(head, "tr"))
    .flatMap((row) => tableElements(row, "th"));
  const rows = tableElements(node, "tbody").flatMap((body) =>
    tableElements(body, "tr"),
  );
  return (
    <Table key={key} aria-label={headers.map(nodeText).join(", ")}>
      <TableHeader>
        {headers.map((header, index) => (
          <TableHead
            key={index}
            id={`column-${index}`}
            isRowHeader={index === 0}
            align={tableAlign(header)}
          >
            {header.children.map((child, i) =>
              renderNode(child, i, navigation),
            )}
          </TableHead>
        ))}
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={index} id={`row-${index}`} textValue={nodeText(row)}>
            {tableElements(row, "td").map((cell, i) => (
              <TableCell key={i} align={tableAlign(cell)}>
                {cell.children.map((child, j) =>
                  renderNode(child, j, navigation),
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TaskListItem(props: { node: ViewerElement; children: ReactNode }) {
  const [checked, setChecked] = useState(props.node.attrs.checked === true);
  return (
    <li
      id={props.node.attrs.id}
      className={props.node.attrs.className}
      data-task=""
    >
      <span className="tkstack-task-checkbox">
        <Checkbox
          label={nodeText(props.node)}
          checked={checked}
          setChecked={setChecked}
        />
      </span>
      {props.children}
    </li>
  );
}

function nodeText(node: ViewerNode): string {
  if (node.type === "text") return node.value;
  if (node.type !== "element") return "";
  return node.children.map(nodeText).join("");
}

function domAttrs(node: ViewerElement) {
  return {
    id: node.attrs.id,
    href: node.attrs.href,
    src: node.attrs.src,
    alt: node.attrs.alt,
    title: node.attrs.title,
    className: node.attrs.className,
    start: node.attrs.start,
  };
}

function InlineChip(props: { children?: ReactNode }) {
  const className = useStyles(inlineCodeClass);
  return <code className={className}>{props.children}</code>;
}

const inlineCodeClass = style(
  monospace,
  radius.md,
  spacing.padding({ x: 2, y: 1 }),
  {
    backgroundColor: colors.gray[4],
  },
);
