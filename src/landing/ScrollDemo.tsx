import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  backgroundColor,
  colors,
  flex,
  shadow,
  text,
} from "maui";
import { useReducedMotion } from "motion/react";
import { style, useStyles } from "purse-styles";
import type { ViewerDocument } from "../parseViewer.ts";
import { ViewerApp } from "../viewer/ViewerApp.tsx";

const NAV_HEIGHT = 52;
const STAGE_HEIGHT = `calc(100svh - ${NAV_HEIGHT}px)`;
const CHROME_HEIGHT = 38;
/** Below this gutter width, callouts move from beside the frame to a caption inside it. */
const MIN_GUTTER = 190;
/** Callout text width beside the frame, and its distance from the frame. */
const COPY_WIDTH = 200;
const COPY_GAP = 24;
/** Space between a callout's dot and the part it points at. */
const TARGET_GAP = 6;
/** The callout title's vertical middle, where its line starts. */
const TITLE_CENTER = 10;
const CORNER = 6;
/** The text fades in, then the line draws from it to the part, then the dot lands. */
const DRAW_MS = 520;

type Callout = {
  /** The part of the spec it explains, found inside the demo's article. */
  selector: string;
  side: "left" | "right";
  /** How far the text sits below (+) or above (−) the part, so lines step up, step down, or run straight. */
  dy: number;
  title: string;
  body: string;
};

/** Sides alternate, so each line crosses only the margin to its own part. */
const callouts: Callout[] = [
  {
    selector: "h1",
    dy: 48,
    side: "right",
    title: "A living spec",
    body: "Your agent writes this before it codes, or for a branch it already wrote.",
  },
  {
    // The link that starts a paragraph, so the line reaches it without crossing text.
    selector: "h2 + p > button:first-child",
    dy: -64,
    side: "left",
    title: "Code links",
    body: "Click a link to open the exact code in the Diff panel.",
  },
  {
    selector: "[data-diffmap-kind='mermaid']",
    dy: 72,
    side: "right",
    title: "Diagram diff",
    body: "Red is what exists today, green is what the change adds. Click a box to open its code.",
  },
  {
    selector: "[data-diffmap-kind='services']",
    dy: -48,
    side: "left",
    title: "Service diagram",
    body: "Steps one request through each service and the state it changes. Press Play.",
  },
  {
    selector: "[data-diffmap-kind='callstack']",
    dy: 0,
    side: "right",
    title: "Call stack",
    body: "Follows the data call by call. Each row opens the line that runs it.",
  },
  {
    selector: "[data-diffmap-kind='changes']",
    dy: 56,
    side: "left",
    title: "Commit summary",
    body: "Each finished phase is one commit, with the files worth reading first.",
  },
  {
    selector: "[data-diffmap-kind='code']",
    dy: -56,
    side: "right",
    title: "Code notes",
    body: "Hover an underlined name to read the agent's note.",
  },
  {
    selector: "li[data-task]",
    dy: -72,
    side: "left",
    title: "Comments",
    body: "Highlight any text or line to comment, then copy every comment back to your agent.",
  },
];

/** `x` is the target's near edge: its left edge for a left callout, its right edge for a right one. */
type Placement = { visible: boolean; x: number; y: number };
type Layout = {
  frameLeft: number;
  frameRight: number;
  width: number;
  height: number;
  placements: Placement[];
};

/**
 * Touch screens scroll the page off the main thread, so a spec scrolled from
 * page scroll events lags behind the finger. There the spec scrolls natively
 * under the finger instead, and the page moves on once it ends.
 */
const touch = window.matchMedia("(pointer: coarse)").matches;

/**
 * A browser window running a real spec, or an empty window holding its
 * place while the spec loads. With a mouse or trackpad, page scroll drives
 * the spec's own scroll while the window is pinned; once the spec ends, the
 * page moves on.
 */
export function ScrollDemo(props: { document: ViewerDocument | undefined }) {
  if (props.document === undefined) return <EmptyFrame />;
  return <LoadedDemo document={props.document} />;
}

function EmptyFrame() {
  const stageClass = useStyles(styles.stage);
  const frameClass = useStyles(styles.frame);
  return (
    <section aria-label="Example spec">
      <div className={stageClass}>
        <div className={frameClass}>
          <BrowserBar url={DEMO_URL} />
        </div>
      </div>
    </section>
  );
}

const DEMO_URL = "diffmap.dev/acme/api/pull/42/specs/sessions-in-postgres.md";

function LoadedDemo(props: { document: ViewerDocument }) {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  // How far the spec scrolls; the section is that much taller than the window.
  const [range, setRange] = useState(0);
  const [layout, setLayout] = useState<Layout>();

  // Built once, so callout updates on every scroll do not re-render the viewer.
  const viewer = useMemo(
    () => <ViewerApp document={props.document} mode="host" />,
    [props.document],
  );

  // The viewer names the tab after its spec; this page keeps its own. Runs after the viewer's own effect.
  useEffect(() => {
    document.title = "diffmap";
  }, []);

  useEffect(() => {
    const article = frame.current!.querySelector("article")!;
    let frameRequest = 0;
    let lastLayout = "";

    const update = () => {
      frameRequest = 0;
      if (!touch) {
        const max = article.scrollHeight - article.clientHeight;
        const pinnedFor =
          NAV_HEIGHT - track.current!.getBoundingClientRect().top;
        article.scrollTop = Math.min(Math.max(pinnedFor, 0), max);
      }

      const stageRect = stage.current!.getBoundingClientRect();
      const frameRect = frame.current!.getBoundingClientRect();
      const view = article.getBoundingClientRect();
      const measured = callouts.map((callout) => {
        const target = article.querySelector(callout.selector);
        if (target === null) return { onScreen: false, x: 0, y: 0 };
        const rect = target.getBoundingClientRect();
        // Small targets such as a link take the line at their middle; cards near their top.
        const anchor = Math.min(
          Math.max(rect.top + Math.min(rect.height / 2, 18), view.top + 28),
          view.bottom - 28,
        );
        return {
          onScreen: rect.top < view.bottom - 40 && rect.bottom > view.top + 40,
          x:
            (callout.side === "left"
              ? rect.left - TARGET_GAP
              : rect.right + TARGET_GAP) - stageRect.left,
          y: anchor - stageRect.top,
        };
      });
      // One callout per side: the part furthest down the spec that is on screen.
      const shown = new Set(
        (["left", "right"] as const).map((side) =>
          measured.findLastIndex(
            (part, index) => part.onScreen && callouts[index]!.side === side,
          ),
        ),
      );
      const next: Layout = {
        frameLeft: frameRect.left - stageRect.left,
        frameRight: frameRect.right - stageRect.left,
        width: stageRect.width,
        height: stageRect.height,
        placements: measured.map((part, index) => ({
          visible: shown.has(index),
          x: Math.round(part.x),
          y: Math.round(part.y),
        })),
      };
      // Most scroll frames move nothing the callouts draw, so skip their re-render.
      const key = JSON.stringify(next);
      if (key === lastLayout) return;
      lastLayout = key;
      setLayout(next);
    };
    const schedule = () => {
      if (frameRequest === 0) frameRequest = requestAnimationFrame(update);
    };
    const measure = () => {
      if (!touch) setRange(article.scrollHeight - article.clientHeight);
      schedule();
    };

    // Diagrams lay out after mount and the Diff panel narrows the column, so re-measure on resize.
    const observer = new ResizeObserver(measure);
    observer.observe(article);
    for (const child of article.children) observer.observe(child);
    window.addEventListener("scroll", schedule, { passive: true });
    article.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      article.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frameRequest);
    };
  }, []);

  const trackClass = useStyles(styles.track);
  const stageClass = useStyles(styles.stage);
  const frameClass = useStyles(styles.frame);
  const viewerClass = useStyles(styles.viewer);
  const gutters =
    layout !== undefined &&
    Math.min(layout.frameLeft, layout.width - layout.frameRight) >= MIN_GUTTER;

  return (
    <section
      ref={track}
      className={trackClass}
      style={{ height: `calc(${STAGE_HEIGHT} + ${range}px)` }}
      aria-label="Example spec"
    >
      <div ref={stage} className={stageClass}>
        <div ref={frame} className={frameClass}>
          <BrowserBar url={DEMO_URL} />
          <div className={viewerClass} data-touch={touch}>
            {viewer}
          </div>
          {layout !== undefined && !gutters && (
            <InlineCaption layout={layout} />
          )}
        </div>
        {layout !== undefined &&
          gutters &&
          callouts.map((callout, index) => (
            <SideCallout
              key={callout.selector}
              callout={callout}
              placement={layout.placements[index]!}
              layout={layout}
            />
          ))}
      </div>
    </section>
  );
}

function BrowserBar(props: { url: string }) {
  const bar = useStyles(styles.bar);
  const controls = useStyles(styles.controls);
  const lights = useStyles(styles.lights);
  const arrows = useStyles(styles.arrows);
  const field = useStyles(styles.field);
  const urlClass = useStyles(styles.url);
  return (
    <div className={bar}>
      <div className={controls} aria-hidden>
        <span className={lights}>
          <i />
          <i />
          <i />
        </span>
        <span className={arrows}>
          <ChevronLeft size="sm" />
          <ChevronRight size="sm" />
        </span>
      </div>
      <div className={field}>
        <Lock size="2xs" />
        <span className={urlClass}>{props.url}</span>
      </div>
      <div />
    </div>
  );
}

function SideCallout(props: {
  callout: Callout;
  placement: Placement;
  layout: Layout;
}) {
  const root = useStyles(styles.callout);
  const copy = useStyles(styles.calloutCopy);
  const title = useStyles(styles.calloutTitle);
  const body = useStyles(styles.calloutBody);
  const svg = useStyles(styles.calloutSvg);
  const reduceMotion = useReducedMotion();
  const left = props.callout.side === "left";
  const { frameLeft, frameRight, width, height } = props.layout;
  const { x, y } = props.placement;
  // The text sits in the margin beside the frame, its title level with the line's start.
  const outer = left
    ? Math.max(16, frameLeft - COPY_GAP - COPY_WIDTH)
    : Math.min(width - 16, frameRight + COPY_GAP + COPY_WIDTH);
  const copyWidth = left
    ? frameLeft - COPY_GAP - outer
    : outer - frameRight - COPY_GAP;
  const startY = Math.min(Math.max(y + props.callout.dy, 40), height - 80);
  const startX = left ? frameLeft - COPY_GAP + 4 : frameRight + COPY_GAP - 4;
  // Lines bend halfway between the text and the frame, then run in to the part.
  const bendX = left ? frameLeft - COPY_GAP / 2 : frameRight + COPY_GAP / 2;
  return (
    <div
      className={root}
      data-side={props.callout.side}
      data-visible={props.placement.visible ? "true" : "false"}
      data-reduced={reduceMotion ? "true" : undefined}
    >
      <div
        className={copy}
        style={{
          top: startY - TITLE_CENTER,
          left: left ? outer : frameRight + COPY_GAP,
          width: copyWidth,
        }}
      >
        <div className={title}>{props.callout.title}</div>
        <div className={body}>{props.callout.body}</div>
      </div>
      <svg className={svg} aria-hidden>
        <path d={elbow(startX, startY, bendX, x, y)} pathLength={1} />
        <circle cx={x} cy={y} r={3.5} />
      </svg>
    </div>
  );
}

/** A line from the text to the part, with rounded corners where it turns. */
function elbow(
  startX: number,
  startY: number,
  bendX: number,
  endX: number,
  endY: number,
) {
  const rise = endY - startY;
  if (Math.abs(rise) < 2) return `M ${startX} ${startY} H ${endX}`;
  const r = Math.min(CORNER, Math.abs(rise) / 2);
  const dx = Math.sign(endX - startX) * r;
  const dy = Math.sign(rise) * r;
  return [
    `M ${startX} ${startY}`,
    `H ${bendX - dx}`,
    `Q ${bendX} ${startY} ${bendX} ${startY + dy}`,
    `V ${endY - dy}`,
    `Q ${bendX} ${endY} ${bendX + dx} ${endY}`,
    `H ${endX}`,
  ].join(" ");
}

/** Narrow windows have no room beside the frame, so the current callout floats at its bottom. */
function InlineCaption(props: { layout: Layout }) {
  const root = useStyles(styles.inline);
  const title = useStyles(styles.calloutTitle);
  const body = useStyles(styles.calloutBody);
  const index = props.layout.placements.findLastIndex(
    (placement) => placement.visible,
  );
  const callout = callouts[index];
  if (callout === undefined) return undefined;
  return (
    <div className={root} key={callout.selector}>
      <div className={title}>{callout.title}</div>
      <div className={body}>{callout.body}</div>
    </div>
  );
}

const styles = {
  track: style({ position: "relative" }),
  stage: style(flex({ direction: "column", alignItems: "center" }), {
    position: "sticky",
    top: `${NAV_HEIGHT}px`,
    height: STAGE_HEIGHT,
    paddingBlock: "20px",
    boxSizing: "border-box",
  }),
  frame: style(shadow.medium, {
    position: "relative",
    width: "min(1000px, calc(100% - 32px))",
    height: "100%",
    borderRadius: "12px",
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
  }),
  viewer: style({
    height: `calc(100% - ${CHROME_HEIGHT}px)`,
    // The viewer fills the window, not the screen.
    "& > div": { height: "100%" },
    // Page scroll drives the article, so the wheel must not scroll it on its own.
    "& article": { overflowY: "hidden" },
    // On touch screens the finger scrolls it, and the page takes over at its ends.
    "&[data-touch='true'] article": { overflowY: "auto" },
  }),
  bar: style({
    display: "grid",
    gridTemplateColumns: "1fr minmax(0, auto) 1fr",
    alignItems: "center",
    gap: "12px",
    height: `${CHROME_HEIGHT}px`,
    paddingInline: "12px",
    boxSizing: "border-box",
    backgroundColor: colors.gray[2],
    borderBottom: `1px solid ${colors.grayAlpha[4]}`,
  }),
  controls: style(flex({ direction: "row", alignItems: "center", gap: 8 })),
  lights: style(flex({ direction: "row", gap: 3 }), {
    "& > i": {
      width: "11px",
      height: "11px",
      borderRadius: "50%",
      boxShadow: "inset 0 0 0 0.5px rgb(0 0 0 / 0.12)",
    },
    "& > i:nth-child(1)": { backgroundColor: "#ff5f57" },
    "& > i:nth-child(2)": { backgroundColor: "#febc2e" },
    "& > i:nth-child(3)": { backgroundColor: "#28c840" },
  }),
  arrows: style(flex({ direction: "row", gap: 2 }), {
    color: colors.gray[9],
    "@media (max-width: 700px)": { display: "none" },
  }),
  field: style(
    flex({ direction: "row", alignItems: "center", gap: 3 }),
    text({ size: "xs", color: "lowContrast" }),
    {
      minWidth: 0,
      width: "min(460px, 100%)",
      justifyContent: "center",
      height: "24px",
      paddingInline: "12px",
      boxSizing: "border-box",
      borderRadius: "6px",
      backgroundColor: colors.grayAlpha[3],
    },
  ),
  url: style({
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  callout: style({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    // Leaving: everything fades together, then the line resets for next time.
    "& > div": {
      transition: "opacity 160ms ease, translate 160ms ease",
      opacity: 0,
    },
    "&[data-side='left'] > div": { translate: "-6px 0", textAlign: "right" },
    "&[data-side='right'] > div": { translate: "6px 0" },
    "& path": {
      fill: "none",
      stroke: colors.blue[8],
      strokeWidth: 1.25,
      strokeDasharray: 1,
      strokeDashoffset: 1,
      // A dash pattern at full offset still leaves a sliver at the line's end, so hide it too.
      opacity: 0,
      transition: "stroke-dashoffset 0s 160ms, opacity 160ms ease",
    },
    "& circle": {
      fill: colors.blue[9],
      stroke: backgroundColor.app,
      strokeWidth: 3,
      paintOrder: "stroke",
      transformBox: "fill-box",
      transformOrigin: "center",
      scale: "0",
      opacity: 0,
      transition: "scale 120ms ease, opacity 120ms ease",
    },
    "&[data-visible='true'] > div": {
      opacity: 1,
      translate: "0 0",
      transition: "opacity 220ms ease, translate 220ms ease",
    },
    "&[data-visible='true'] path": {
      strokeDashoffset: 0,
      opacity: 1,
      transition: `stroke-dashoffset ${DRAW_MS}ms cubic-bezier(0.65, 0, 0.35, 1) 140ms, opacity 0s 140ms`,
    },
    "&[data-visible='true'] circle": {
      scale: "1",
      opacity: 1,
      transition: `scale 240ms cubic-bezier(0.34, 1.56, 0.64, 1) ${DRAW_MS + 80}ms, opacity 0s ${DRAW_MS + 80}ms`,
    },
    "&[data-reduced='true'] path": { transition: "none" },
    "&[data-reduced='true'] circle": { transition: "none" },
    "&[data-reduced='true'] > div": { transition: "none" },
  }),
  calloutCopy: style(flex({ direction: "column", gap: 1 }), {
    position: "absolute",
  }),
  calloutTitle: style(text({ size: "sm", fontWeight: 600 }), {
    color: colors.blue[11],
  }),
  calloutBody: style(text({ size: "xs" }), {
    color: colors.blue[11],
    opacity: 0.85,
    textWrap: "pretty",
  }),
  calloutSvg: style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    overflow: "visible",
  }),
  inline: style(shadow.medium, flex({ direction: "column", gap: 1 }), {
    position: "absolute",
    left: "12px",
    right: "12px",
    bottom: "12px",
    padding: "10px 12px",
    borderRadius: "8px",
    backgroundColor: colors.blue[2],
    pointerEvents: "none",
  }),
};
