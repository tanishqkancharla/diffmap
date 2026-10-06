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
} from "maui";
import { style, useStyles } from "purse-styles";
import { mermaidSvg } from "../mermaid.js";
import type { DiagramAnnotation } from "../diagramAnnotations.js";
import type { SourceNavigation } from "../annotations.js";
import { linkDiagram } from "./diagramLinks.js";

type MermaidProps = {
  source: string;
  annotations: DiagramAnnotation[];
} & SourceNavigation;

export function MermaidBlock(props: MermaidProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const frame = useStyles(styles.frame);
  const expand = useStyles(styles.expand);
  const dialog = useStyles(styles.dialog);
  const header = useStyles(styles.header);
  return (
    <div className={frame}>
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
        aria-label="Diagram"
        className={dialog}
      >
        <div className={header}>
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
    </div>
  );
}

function MermaidDiagram(props: MermaidProps & { fullscreen: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const shell = useStyles(
    styles.shell,
    props.fullscreen ? styles.fullscreenShell : styles.inlineShell,
  );
  const svg = useMemo(
    () =>
      mermaidSvg({
        source: props.source,
        bg: backgroundColor.app,
        fg: colors.gray[12],
        accent: colors.accent[9],
        muted: colors.gray[11],
        surface: backgroundColor.element,
        border: colors.gray[6],
        font: fontFamily,
      }),
    [props.source],
  );
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
  frame: style({
    position: "relative",
    width: "100%",
    minWidth: 0,
  }),
  expand: style({
    position: "absolute",
    top: 0,
    insetInlineEnd: 0,
  }),
  dialog: style({
    width: "calc(100vw - 32px)",
    height: "calc(100dvh - 32px)",
    padding: spacing.value(6),
    "& > [role='dialog']": { flex: 1, minHeight: 0, gap: spacing.value(2) },
  }),
  header: style({
    display: "flex",
    justifyContent: "flex-end",
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
  }),
};
