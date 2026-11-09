import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { createPortal } from "react-dom";
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
/** On touch: the column in the window's 16px margin, left of the spec, where lines run up to their part. */
const LINE_X = 4;
/** On touch: the caption's height at the screen's bottom edge, which parts must clear to count as on screen. */
const CAPTION_SPACE = 96;
/** On touch: the corner where a line turns from the margin toward its part. */
const ELBOW_RADIUS = 6;

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

/**
 * `x` is the target's near edge: its left edge for a left callout, its right
 * edge for a right one. On touch, `x`, `y`, and `span` are the part's left
 * edge, top, and height inside the spec's article, which scrolling does not
 * change.
 */
type Placement = { visible: boolean; x: number; y: number; span: number };
type Layout = {
  frameLeft: number;
  frameRight: number;
  width: number;
  height: number;
  /** On touch: how far below the screen's top edge the window's sticky bars end. */
  barsBottom: number;
  placements: Placement[];
};

/**
 * Touch screens scroll the page off the main thread, so a spec scrolled from
 * page scroll events lags behind the finger, and a second scroll area makes
 * the reader stop and swipe again. There the window grows to the whole spec
 * and scrolls with the page, its bars sticking to the top.
 */
const touch = window.matchMedia("(pointer: coarse)").matches;

/**
 * A browser window running a real spec, or an empty window holding its
 * place while the spec loads. With a mouse or trackpad, page scroll drives
 * the spec's own scroll while the window is pinned; once the spec ends, the
 * page moves on. On touch screens the window is as tall as the spec.
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
  // On touch, lines are drawn inside the article, under the spec's sticky title bar.
  const [articleElement, setArticleElement] = useState<HTMLElement>();

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
    setArticleElement(article);
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
      const articleRect = article.getBoundingClientRect();
      // On touch the spec shows between its sticky bars and the screen's bottom edge.
      const view = touch
        ? {
            top: frame.current!.querySelector("header")!.getBoundingClientRect()
              .bottom,
            bottom: Math.min(
              articleRect.bottom,
              window.innerHeight - CAPTION_SPACE,
            ),
          }
        : articleRect;
      const measured = callouts.map((callout) => {
        const target = article.querySelector(callout.selector);
        if (target === null) return { onScreen: false, x: 0, y: 0, span: 0 };
        const rect = target.getBoundingClientRect();
        const onScreen =
          rect.top < view.bottom - 40 && rect.bottom > view.top + 40;
        // The line is drawn in the window, so it moves with the part as the page scrolls.
        if (touch)
          return {
            onScreen,
            x: Math.round(rect.left - articleRect.left),
            y: Math.round(rect.top - articleRect.top),
            span: Math.round(rect.height),
          };
        // Small targets such as a link take the line at their middle; cards near their top.
        const anchor = Math.min(
          Math.max(rect.top + Math.min(rect.height / 2, 18), view.top + 28),
          view.bottom - 28,
        );
        return {
          onScreen,
          span: 0,
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
        barsBottom: touch
          ? NAV_HEIGHT +
            CHROME_HEIGHT +
            frame.current!.querySelector("header")!.offsetHeight
          : 0,
        placements: measured.map((part, index) => ({
          visible: shown.has(index),
          x: Math.round(part.x),
          y: Math.round(part.y),
          span: part.span,
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
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frameRequest);
    };
  }, []);

  const trackClass = useStyles(styles.track);
  const stageClass = useStyles(styles.stage);
  const frameClass = useStyles(styles.frame);
  const viewerClass = useStyles(styles.viewer);
  const dockClass = useStyles(styles.dock);
  const gutters =
    layout !== undefined &&
    Math.min(layout.frameLeft, layout.width - layout.frameRight) >= MIN_GUTTER;

  return (
    <section
      ref={track}
      className={trackClass}
      style={
        touch ? undefined : { height: `calc(${STAGE_HEIGHT} + ${range}px)` }
      }
      aria-label="Example spec"
    >
      <div ref={stage} className={stageClass} data-touch={touch}>
        <div ref={frame} className={frameClass} data-touch={touch}>
          <BrowserBar url={DEMO_URL} />
          <div className={viewerClass} data-touch={touch}>
            {viewer}
          </div>
          {layout !== undefined &&
            !gutters &&
            articleElement !== undefined &&
            touch &&
            createPortal(<TouchLine layout={layout} />, articleElement)}
          {layout !== undefined &&
            !gutters && (
              // On touch, held at the screen's bottom edge while the window passes.
              <div className={touch ? dockClass : undefined}>
                <InlineCaption layout={layout} />
              </div>
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
/**
 * On touch, a line from the part straight down into the caption. It hangs
 * from the part inside the window, so it scrolls with the part on its own;
 * the caption covers its lower end. On a tall part scrolled past its top,
 * the dot sticks below the window's bars until the part's bottom passes.
 */
function TouchLine(props: { layout: Layout }) {
  const index = props.layout.placements.findLastIndex(
    (placement) => placement.visible,
  );
  const callout = callouts[index];
  if (callout === undefined) return undefined;
  return (
    <DrawnLine
      key={callout.selector}
      placement={props.layout.placements[index]!}
      stickAt={props.layout.barsBottom + 12}
    />
  );
}

function DrawnLine(props: { placement: Placement; stickAt: number }) {
  const root = useStyles(styles.touchLine);
  const pin = useStyles(styles.touchPin);
  const dot = useRef<HTMLElement>(null);
  const turn = useRef<HTMLElement>(null);
  const line = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  // The dot lands on the part's border, then the line turns out of it and drops into the caption.
  useLayoutEffect(() => {
    if (reduceMotion === true) return;
    dot.current!.animate([{ scale: 0 }, { scale: 1 }], {
      duration: 240,
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      fill: "backwards",
    });
    turn.current!.animate(
      [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }],
      { duration: 140, delay: 120, easing: "ease-in", fill: "backwards" },
    );
    line.current!.animate([{ scale: "1 0" }, { scale: "1 1" }], {
      duration: DRAW_MS * 1.4,
      delay: 260,
      easing: "cubic-bezier(0.65, 0, 0.35, 1)",
      fill: "backwards",
    });
  }, [reduceMotion]);
  const { x, y, span } = props.placement;
  // From the line's column in the margin to the part's left border, turning on a rounded corner.
  const run = Math.max(x - LINE_X, 0);
  const corner = Math.min(ELBOW_RADIUS, run);
  // Small targets such as a link take the dot at their middle; cards near their top.
  return (
    <div className={root} style={{ top: y, height: span }} aria-hidden>
      <div
        className={pin}
        style={{ top: props.stickAt, marginTop: Math.min(span / 2, 18) }}
      >
        <i ref={line} style={{ top: corner }} />
        <i ref={turn} style={{ width: run, height: corner }} />
        <i ref={dot} style={{ left: run }} />
      </div>
    </div>
  );
}

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
    "&[data-touch='true']": { position: "relative", top: 0, height: "auto" },
  }),
  frame: style(shadow.medium, {
    position: "relative",
    width: "min(1000px, calc(100% - 32px))",
    height: "100%",
    borderRadius: "12px",
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
    // Clips its corners without becoming a scroller, so its bars can stick to the page.
    "&[data-touch='true']": { height: "auto", overflow: "clip" },
    "&[data-touch='true'] > :first-child": {
      position: "sticky",
      top: `${NAV_HEIGHT}px`,
      zIndex: 3,
    },
    // Hides spec text that scrolled past the bar, which would show through the frosted nav.
    "&[data-touch='true'] > :first-child::before": {
      content: '""',
      position: "absolute",
      insetInline: 0,
      bottom: "100%",
      height: `${NAV_HEIGHT}px`,
      backgroundColor: backgroundColor.app,
    },
  }),
  viewer: style({
    height: `calc(100% - ${CHROME_HEIGHT}px)`,
    // The viewer fills the window, not the screen.
    "& > div": { height: "100%" },
    // Page scroll drives the article, so the wheel must not scroll it on its own.
    "& article": { overflowY: "hidden" },
    // On touch the viewer grows to its whole spec and nothing inside it scrolls.
    // Isolated, so the viewer's own layers stay under the window's bars and caption.
    "&[data-touch='true']": { height: "auto", isolation: "isolate" },
    "&[data-touch='true'] > div": { height: "auto", overflow: "visible" },
    "&[data-touch='true'] > div > header": {
      position: "sticky",
      top: `${NAV_HEIGHT + CHROME_HEIGHT}px`,
      zIndex: 2,
    },
    "&[data-touch='true'] > div > div > div": {
      overflow: "visible",
      gridTemplateRows: "auto",
    },
    "&[data-touch='true'] article": {
      position: "relative",
      overflowY: "visible",
      containerType: "normal",
    },
    // The Diff panel follows the article, so it rides the bottom edge instead of waiting at the spec's end.
    "&[data-touch='true'] article + *": {
      position: "sticky",
      bottom: 0,
      zIndex: 2,
    },
  }),
  // Zero height, so holding the caption adds no space at the window's end.
  dock: style({
    position: "sticky",
    bottom: 0,
    height: 0,
    zIndex: 3,
    // Across the window's bottom edge, so it covers the lower end of its line.
    "& > div": {
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: "10px 10px 0 0",
      padding: "12px 16px 14px",
    },
  }),
  // Spans its part, so the sticky dot inside it is released with the part's bottom.
  touchLine: style({
    position: "absolute",
    left: `${LINE_X}px`,
    width: 0,
    pointerEvents: "none",
    zIndex: 1,
  }),
  touchPin: style({
    position: "sticky",
    height: 0,
    // A screen tall, so it always reaches the caption below.
    "& > i:nth-child(1)": {
      position: "absolute",
      left: "-0.625px",
      width: "1.25px",
      height: "100svh",
      backgroundColor: colors.blue[8],
      transformOrigin: "top",
    },
    // The turn: the top and left borders of a box with one rounded corner.
    "& > i:nth-child(2)": {
      position: "absolute",
      left: "-0.625px",
      top: "-0.625px",
      boxSizing: "content-box",
      borderTop: `1.25px solid ${colors.blue[8]}`,
      borderLeft: `1.25px solid ${colors.blue[8]}`,
      borderTopLeftRadius: `${ELBOW_RADIUS}px`,
    },
    // Set into the part's border, ringed in page color so it reads over the border line.
    "& > i:nth-child(3)": {
      position: "absolute",
      top: "-3.5px",
      width: "7px",
      height: "7px",
      marginLeft: "-3.5px",
      borderRadius: "50%",
      backgroundColor: colors.blue[9],
      boxShadow: `0 0 0 2px ${backgroundColor.app}`,
    },
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
