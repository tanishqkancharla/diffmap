import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Close,
  Dialog,
  Maximize,
  backgroundColor,
  colors,
  fontFamily,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { mermaidSvg } from "../mermaid.js";
import type { DiagramAnnotation } from "../diagramAnnotations.js";
import type { SourceNavigation } from "../annotations.js";
import { markDiagramChanges } from "./diagramDiff.js";
import { linkDiagram } from "./diagramLinks.js";
import { fenceTitle, pierreShell } from "./pierre.js";

type MermaidProps = {
  source: string;
  annotations: DiagramAnnotation[];
  sides: { today: string; proposed: string } | undefined;
  title: string | undefined;
} & SourceNavigation;

export function MermaidBlock(props: MermaidProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const frame = useStyles(pierreShell, styles.frame);
  const expand = useStyles(styles.expand);
  const dialog = useStyles(styles.dialog);
  const header = useStyles(styles.header);
  const caption = useStyles(fenceTitle);
  const dialogTitle = useStyles(styles.dialogTitle);
  return (
    <figure className={frame}>
      {props.title !== undefined && (
        <figcaption className={caption}>{props.title}</figcaption>
      )}
      <MermaidDiagram {...props} fullscreen={false} />
      <Button
        className={expand}
        size="sm"
        variant="quiet"
        aria-label="Full screen"
        onClick={() => setFullscreen(true)}
      >
        <Maximize size="xs" />
      </Button>
      <Dialog
        isOpen={fullscreen}
        onOpenChange={setFullscreen}
        size="lg"
        aria-label={props.title ?? "Diagram"}
        className={dialog}
      >
        <div className={header}>
          <span className={dialogTitle}>{props.title}</span>
          <Button
            size="sm"
            variant="quiet"
            slot="close"
            aria-label="Exit full screen"
          >
            <Close size="xs" />
          </Button>
        </div>
        <MermaidDiagram
          {...props}
          fullscreen
          onSelectAnnotation={(annotation) => {
            // The Diff panel opens behind the dialog, so leave full screen.
            setFullscreen(false);
            props.onSelectAnnotation(annotation);
          }}
        />
      </Dialog>
    </figure>
  );
}

function MermaidDiagram(props: MermaidProps & { fullscreen: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const shell = useStyles(
    styles.shell,
    props.fullscreen ? styles.fullscreenShell : styles.inlineShell,
  );
  const svg = useMemo(() => {
    const draw = (source: string) =>
      mermaidSvg({
        source,
        bg: backgroundColor.app,
        fg: colors.gray[12],
        accent: colors.accent[9],
        muted: colors.gray[11],
        surface: backgroundColor.element,
        border: colors.gray[6],
        font: fontFamily,
      });
    const all = draw(props.source);
    if (all instanceof Error || props.sides === undefined) return all;
    const today = draw(props.sides.today);
    if (today instanceof Error) return today;
    const proposed = draw(props.sides.proposed);
    if (proposed instanceof Error) return proposed;
    return markDiagramChanges(all, { today, proposed });
  }, [props.source, props.sides]);
  const linked = useMemo(
    () => (svg instanceof Error ? svg : linkDiagram(svg, props.annotations)),
    [svg, props.annotations],
  );
  // React replaces innerHTML when this object changes, which drops SVG focus.
  const html = useMemo(
    () => ({ __html: linked instanceof Error ? "" : linked }),
    [linked],
  );
  useEffect(() => {
    if (linked instanceof Error) return;
    for (const target of container.current!.querySelectorAll(
      "[data-source-index]",
    )) {
      const annotation =
        props.annotations[Number(target.getAttribute("data-source-index"))]!
          .annotation;
      target.setAttribute(
        "aria-pressed",
        String(annotation === props.selectedAnnotation),
      );
    }
  }, [linked, props.annotations, props.selectedAnnotation]);
  if (linked instanceof Error) {
    return (
      <div ref={container} className={shell} data-diffmap-kind="mermaid">
        {linked.message}
      </div>
    );
  }
  return (
    <div
      ref={container}
      className={shell}
      data-diffmap-kind="mermaid"
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const element = target.closest("[data-source-index]");
        if (element === null) return;
        props.onSelectAnnotation(
          props.annotations[Number(element.getAttribute("data-source-index"))]!
            .annotation,
        );
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const element = target.closest("[data-source-index]");
        if (element === null) return;
        event.preventDefault();
        props.onSelectAnnotation(
          props.annotations[Number(element.getAttribute("data-source-index"))]!
            .annotation,
        );
      }}
      dangerouslySetInnerHTML={html}
    />
  );
}

const styles = {
  // A card like a code block: the title row, then the diagram, padded.
  frame: style({
    position: "relative",
    width: "100%",
    margin: 0,
    // Room for the full-screen button, which sits in the title row.
    "& > figcaption": { paddingRight: "40px" },
    "& > [data-diffmap-kind='mermaid']": { padding: spacing.value(6) },
  }),
  expand: style({
    position: "absolute",
    top: "6px",
    right: "6px",
  }),
  dialogTitle: style(
    text({ size: "xs", fontWeight: 500, color: "lowContrast" }),
  ),
  dialog: style({
    width: "calc(100vw - 32px)",
    height: "calc(100dvh - 32px)",
    padding: spacing.value(6),
    "& > [role='dialog']": { flex: 1, minHeight: 0, gap: spacing.value(2) },
  }),
  header: style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  }),
  inlineShell: style({
    maxHeight: "60vh",
    "& svg": { maxHeight: "60vh" },
  }),
  fullscreenShell: style({
    flex: 1,
    "& svg": { height: "100%" },
  }),
  shell: style({
    width: "100%",
    minHeight: 0,
    overflow: "auto",
    minWidth: 0,
    border: 0,
    boxShadow: "none",
    "& .source-target": { cursor: "pointer" },
    "& .source-target:focus, & .source-target:focus-visible": {
      outline: "none",
    },
    "& .source-hit": { pointerEvents: "stroke" },
    "& .source-node:hover > g > rect, & .source-node:hover > g > polygon": {
      fill: colors.blue[2],
      stroke: colors.blue[8],
      strokeWidth: 2,
    },
    "& .source-node:hover text": { fill: colors.blue[10] },
    "& .source-node[aria-pressed='true'] > g > rect, & .source-node[aria-pressed='true'] > g > polygon":
      { fill: colors.blue[3], stroke: colors.blue[9], strokeWidth: 2 },
    "& .source-node[aria-pressed='true'] text": { fill: colors.blue[11] },
    "& .source-edge:hover > .edge, & .source-edge:hover > .message > line, & .source-edge:hover > .message > polyline, & .source-edge:hover > .class-relationship, & .source-edge:hover > .er-relationship":
      { stroke: colors.blue[8], strokeWidth: 1.5 },
    "& .source-edge[aria-pressed='true'] > .edge, & .source-edge[aria-pressed='true'] > .message > line, & .source-edge[aria-pressed='true'] > .message > polyline, & .source-edge[aria-pressed='true'] > .class-relationship, & .source-edge[aria-pressed='true'] > .er-relationship":
      { stroke: colors.blue[9], strokeWidth: 2 },
    "& svg": {
      display: "block",
      width: "100%",
      height: "auto",
    },
    ...changeStyles("-", colors.red),
    ...changeStyles("+", colors.green),
    ...changeStyles("~", colors.amber),
  }),
};

/** Colors a `mermaid diff`'s marked nodes and edges; removed ones are dashed. */
function changeStyles(sign: string, scale: typeof colors.red) {
  const marked = `[data-change='${sign}']`;
  const dash = sign === "-" ? { strokeDasharray: "5 3" } : {};
  return {
    [`& [data-id]${marked} > :is(rect, polygon, circle, ellipse, path), & .edge-label${marked} > rect`]:
      { fill: scale[2], stroke: scale[9], strokeWidth: 1.5, ...dash },
    [`& ${marked} text`]: { fill: scale[11] },
    [`& :is(polyline, line)${marked}, & ${marked} > :is(line, polyline, path)`]:
      { stroke: scale[9], strokeWidth: 1.5, ...dash },
  };
}
