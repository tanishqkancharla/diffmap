import { useEffect, useMemo, useRef, useState } from "react";
import { backgroundColor, colors, fontFamily } from "maui";
import { style, useStyles } from "purse-styles";
import { mermaidSvg } from "../mermaid.js";
import type { DiagramAnnotation } from "../diagramAnnotations.js";
import type { SourceNavigation } from "../annotations.js";
import { linkDiagram } from "./diagramLinks.js";

export function MermaidBlock(
  props: {
    source: string;
    annotations: DiagramAnnotation[];
  } & SourceNavigation,
) {
  const container = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const shell = useStyles(styles.shell);
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
  const naturalWidth = useMemo(() => {
    if (linked instanceof Error) return undefined;
    const element = new DOMParser().parseFromString(
      linked,
      "image/svg+xml",
    ).documentElement;
    const width = Number(element.getAttribute("width"));
    return width > 0 ? width : undefined;
  }, [linked]);
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
      <div ref={container} className={shell} data-tkstack-kind="mermaid">
        {linked.message}
      </div>
    );
  }
  return (
    <div
      ref={container}
      className={shell}
      data-tkstack-kind="mermaid"
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
    >
      <div className="diagram-toolbar" aria-label="Diagram zoom">
        <span>
          {props.annotations.length
            ? "Click a box or arrow to explore"
            : "Diagram"}
        </span>
        <button
          aria-label="Zoom out diagram"
          disabled={zoom <= 0.75}
          onClick={() => setZoom(Math.max(0.75, zoom - 0.25))}
        >
          −
        </button>
        <button aria-label="Reset diagram zoom" onClick={() => setZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
        <button
          aria-label="Zoom in diagram"
          disabled={zoom >= 2.5}
          onClick={() => setZoom(Math.min(2.5, zoom + 0.25))}
        >
          +
        </button>
      </div>
      <div
        className="diagram-canvas"
        style={{
          width: `${zoom * 100}%`,
          maxWidth: naturalWidth ? `${naturalWidth * zoom}px` : undefined,
          marginInline: "auto",
        }}
        dangerouslySetInnerHTML={html}
      />
    </div>
  );
}

const styles = {
  shell: style({
    width: "100%",
    maxHeight: "60vh",
    overflow: "auto",
    minWidth: 0,
    border: 0,
    boxShadow: "none",
    "& .diagram-toolbar": {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      position: "sticky",
      top: 0,
      left: 0,
      zIndex: 1,
      padding: "6px 0",
      backgroundColor: backgroundColor.app,
      fontSize: "12px",
      color: colors.gray[11],
    },
    "& .diagram-toolbar span": { marginRight: "auto" },
    "& .diagram-toolbar button": {
      border: `1px solid ${colors.gray[6]}`,
      borderRadius: "4px",
      backgroundColor: backgroundColor.app,
      padding: "3px 8px",
      cursor: "pointer",
      color: colors.gray[12],
    },
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
      maxHeight: "none",
    },
  }),
};
