import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ArrowLeft,
  ArrowRight,
  Button,
  Check,
  Checkbox,
  ChevronRight,
  Close,
  Maximize,
  colors,
  focusRing,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { FlowState } from "../../parseFence.js";
import type { PreviewStoryInfo } from "../../preview/protocol.js";
import { fenceTitle, pierreShell } from "../pierre.js";
import { storyLabel, storyLabelFromId, useDiffmapConfig } from "./config.ts";
import {
  layoutFlow,
  stateAncestry,
  stateChildren,
  stateDepth,
  statePath,
} from "./flowTree.ts";
import { usePreviewPage } from "./PreviewBlock.tsx";
import { PreviewFrame, type FrameRequest } from "./PreviewFrame.tsx";
import { useReviewedStates } from "./reviewedStates.ts";

/** Thumbnails render the app this wide, then scale down, so they show the layout a reader sees at full size. */
const THUMBNAIL_RENDER_WIDTH = 720;
const MAP_CARD = { width: 152, height: 128, gapX: 32, gapY: 16 };

/**
 * A `flow` fence: one live frame of the app moving through a user journey, with the viewer's controls around it.
 * Expanding fixes the same frame to the window and lays the outline and a map of every state around it, so the
 * live UI, and anything the reader typed into it, survives.
 */
export function FlowBlock(props: {
  states: FlowState[];
  title: string | undefined;
}) {
  const { states } = props;
  const page = usePreviewPage();
  const config = useDiffmapConfig();
  const flows =
    config !== undefined && "config" in config
      ? config.config.flows
      : undefined;
  const transitions = flows?.transitions ?? "play";
  const viewport = flows?.viewport;

  const [selected, setSelected] = useState(0);
  const [reached, setReached] = useState<number | undefined>(undefined);
  const [request, setRequest] = useState<FrameRequest | undefined>(undefined);
  const [catalog, setCatalog] = useState<Map<string, PreviewStoryInfo>>();
  const [fingerprints, setFingerprints] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [lockedHeight, setLockedHeight] = useState<number | undefined>();
  const seq = useRef(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const { isReviewed, setReviewed } = useReviewedStates();

  const indexOf = (story: string) =>
    states.findIndex((state) => state.story === story);
  const label = (index: number) => {
    const info = catalog?.get(states[index]!.story);
    return info === undefined
      ? storyLabelFromId(states[index]!.story)
      : storyLabel(info.name);
  };
  const reviewKey = (index: number) =>
    `flow:${statePath(states, index).join(">")}`;
  const select = (index: number) => {
    if (index === selected && reached === index) return;
    const how =
      transitions === "play" &&
      reached !== undefined &&
      states[index]!.parent === reached
        ? "play"
        : "render";
    setSelected(index);
    seq.current += 1;
    setRequest({ path: statePath(states, index), how, seq: seq.current });
  };
  const expand = (next: boolean) => {
    if (next) setLockedHeight(wrapper.current!.offsetHeight);
    setExpanded(next);
  };

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    figure.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  useEffect(() => {
    const container = stripRef.current;
    const card = container?.querySelector(`[data-state='${selected}']`);
    if (container === null || card === null || card === undefined) return;
    const box = container.getBoundingClientRect();
    const at = card.getBoundingClientRect();
    container.scrollTo({
      left:
        container.scrollLeft + at.left - box.left - (box.width - at.width) / 2,
      top:
        container.scrollTop + at.top - box.top - (box.height - at.height) / 2,
      behavior: expanded ? "instant" : "smooth",
    });
  }, [selected, expanded]);

  const layout = layoutFlow(states);
  const ancestry = stateAncestry(states, selected);
  const children = stateChildren(states, selected);
  const parent = states[selected]!.parent;
  const playing = catalog !== undefined && reached !== selected;
  const note = catalog?.get(states[selected]!.story)?.description;
  const fingerprint = fingerprints[states[selected]!.story];

  const wrapperClass = useStyles(styles.wrapper);
  const scrim = useStyles(styles.scrim);
  const card = useStyles(
    pierreShell,
    styles.card,
    expanded && styles.expandedCard,
  );
  const header = useStyles(fenceTitle, styles.header);
  const crumbs = useStyles(styles.crumbs);
  const crumb = useStyles(styles.crumb);
  const body = useStyles(styles.body, expanded && styles.expandedBody);
  const outline = useStyles(styles.outline);
  const outlineItem = useStyles(styles.outlineItem);
  const stage = useStyles(styles.stage, expanded && styles.expandedStage);
  const controls = useStyles(styles.controls);
  const noteClass = useStyles(styles.note);
  const actions = useStyles(styles.actions);
  const crumbStep = useStyles(styles.crumbStep);
  const strip = useStyles(styles.strip, expanded && styles.map);
  const thumb = useStyles(styles.thumb, expanded && styles.mapCard);
  const thumbFrame = useStyles(styles.thumbFrame, expanded && styles.mapFrame);
  const thumbLabel = useStyles(styles.thumbLabel);
  const edges = useStyles(styles.edges);

  if ("message" in page)
    return (
      <figure className={card} data-diffmap-kind="flow">
        {props.title !== undefined && (
          <figcaption className={header}>{props.title}</figcaption>
        )}
        {page.message}
      </figure>
    );

  const mapPosition = (index: number) => ({
    left: layout.placements[index]!.column * (MAP_CARD.width + MAP_CARD.gapX),
    top: layout.placements[index]!.row * (MAP_CARD.height + MAP_CARD.gapY),
  });

  return (
    <div
      ref={wrapper}
      className={wrapperClass}
      style={{ height: expanded ? lockedHeight : undefined }}
    >
      {expanded && <div className={scrim} onClick={() => expand(false)} />}
      <figure
        ref={figure}
        className={card}
        data-diffmap-kind="flow"
        tabIndex={-1}
        aria-label={props.title ?? "Flow"}
        aria-modal={expanded || undefined}
        role={expanded ? "dialog" : undefined}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowRight" && children[0] !== undefined)
            select(children[0]);
          if (event.key === "ArrowLeft" && parent !== undefined) select(parent);
        }}
      >
        <figcaption className={header}>
          {props.title !== undefined && <span>{props.title}</span>}
          <nav className={crumbs} aria-label="Steps taken">
            {ancestry.map((index, position) => (
              <span key={index} className={crumbStep}>
                {position > 0 && <ChevronRight size="2xs" />}
                <button
                  type="button"
                  className={crumb}
                  aria-current={index === selected ? "step" : undefined}
                  onClick={() => select(index)}
                >
                  {label(index)}
                </button>
              </span>
            ))}
          </nav>
          {playing && (
            <ActivityIndicator size="xs" aria-label="Playing the step" />
          )}
          <Button
            size="sm"
            variant="quiet"
            aria-label={expanded ? "Collapse the flow" : "Expand the flow"}
            onClick={() => expand(!expanded)}
          >
            {expanded ? <Close size="xs" /> : <Maximize size="xs" />}
          </Button>
        </figcaption>
        <div className={body}>
          {expanded && (
            <nav className={outline} aria-label="Every state">
              {states.map((state, index) => (
                <button
                  key={state.story}
                  type="button"
                  className={outlineItem}
                  aria-current={index === selected ? "step" : undefined}
                  style={{ paddingLeft: 12 + stateDepth(states, index) * 14 }}
                  onClick={() => select(index)}
                >
                  <span>{label(index)}</span>
                  {state.action !== undefined && <small>{state.action}</small>}
                  {isReviewed(reviewKey(index), fingerprints[state.story]) && (
                    <Check size="xs" />
                  )}
                </button>
              ))}
            </nav>
          )}
          <div className={stage}>
            <PreviewFrame
              page={page.url}
              initialPath={[states[0]!.story]}
              mode="live"
              lazy
              request={request}
              renderWidth={expanded ? viewport?.width : undefined}
              renderHeight={expanded ? viewport?.height : undefined}
              maxHeight={expanded ? undefined : 640}
              label={`${props.title ?? "Flow"}: ${label(selected)}`}
              onReady={(stories) =>
                setCatalog(new Map(stories.map((story) => [story.id, story])))
              }
              onState={(state) => {
                const index = indexOf(state.story);
                if (index === -1) return;
                setReached(index);
                setFingerprints((current) =>
                  current[state.story] === undefined
                    ? { ...current, [state.story]: state.fingerprint }
                    : current,
                );
              }}
            />
            <div className={controls}>
              {note !== undefined && <div className={noteClass}>{note}</div>}
              <div className={actions}>
                <Button
                  size="sm"
                  isDisabled={parent === undefined}
                  onClick={() => parent !== undefined && select(parent)}
                >
                  <ArrowLeft size="xs" />
                  Back
                </Button>
                {children.map((child) => (
                  <Button
                    key={child}
                    size="sm"
                    variant="primary"
                    onClick={() => select(child)}
                  >
                    {states[child]!.action}
                    <ArrowRight size="xs" />
                  </Button>
                ))}
                {children.length === 0 && (
                  <span className={noteClass}>End of this path</span>
                )}
              </div>
              <Checkbox
                label="Reviewed"
                checked={isReviewed(reviewKey(selected), fingerprint)}
                setChecked={(value) => {
                  if (fingerprint !== undefined)
                    setReviewed(reviewKey(selected), fingerprint, value);
                }}
              />
            </div>
          </div>
          <div ref={stripRef} className={strip}>
            {expanded && (
              <div
                aria-hidden
                style={{
                  width: `calc(${layout.columns * (MAP_CARD.width + MAP_CARD.gapX) - MAP_CARD.gapX}px + 2 * ${spacing.value(8)})`,
                  height: `calc(${layout.rows * (MAP_CARD.height + MAP_CARD.gapY) - MAP_CARD.gapY}px + 2 * ${spacing.value(8)})`,
                }}
              />
            )}
            {expanded && (
              <svg className={edges} aria-hidden>
                {states.map((state, index) => {
                  if (state.parent === undefined) return undefined;
                  const from = mapPosition(state.parent);
                  const to = mapPosition(index);
                  const x1 = from.left + MAP_CARD.width;
                  const y1 = from.top + MAP_CARD.height / 2;
                  const x2 = to.left;
                  const y2 = to.top + MAP_CARD.height / 2;
                  const mid = (x1 + x2) / 2;
                  return (
                    <path
                      key={state.story}
                      d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                      data-active={ancestry.includes(index) || undefined}
                    />
                  );
                })}
              </svg>
            )}
            {states.map((state, index) => (
              <button
                key={state.story}
                type="button"
                className={thumb}
                aria-current={index === selected ? "step" : undefined}
                aria-label={label(index)}
                data-state={index}
                style={expanded ? mapPosition(index) : undefined}
                onClick={() => select(index)}
              >
                <div className={thumbFrame}>
                  {catalog !== undefined && (
                    <PreviewFrame
                      page={page.url}
                      initialPath={statePath(states, index)}
                      mode="thumbnail"
                      renderWidth={THUMBNAIL_RENDER_WIDTH}
                      label={label(index)}
                      onState={(next) =>
                        setFingerprints((current) => ({
                          ...current,
                          [state.story]: next.fingerprint,
                        }))
                      }
                    />
                  )}
                </div>
                <span className={thumbLabel}>
                  <span>{state.action ?? "Start"}</span>
                  {isReviewed(reviewKey(index), fingerprints[state.story]) && (
                    <Check size="xs" />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </figure>
    </div>
  );
}

const styles = {
  wrapper: style({ position: "relative", width: "100%" }),
  scrim: style({
    position: "fixed",
    inset: 0,
    zIndex: 50,
    backgroundColor: "rgb(0 0 0 / 0.25)",
  }),
  card: style({ width: "100%", margin: 0, outline: "none" }),
  expandedCard: style({
    position: "fixed",
    inset: "16px",
    zIndex: 51,
    width: "auto",
    display: "flex",
    flexDirection: "column",
    backgroundColor: colors.gray[1],
  }),
  header: style({
    display: "flex",
    alignItems: "center",
    gap: spacing.value(4),
    minHeight: "36px",
    "& > span:first-child": { flexShrink: 0, color: colors.gray[12] },
  }),
  crumbs: style({
    display: "flex",
    alignItems: "center",
    gap: spacing.value(1),
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
  }),
  crumbStep: style({
    display: "flex",
    alignItems: "center",
    gap: spacing.value(1),
    flexShrink: 0,
  }),
  crumb: style(text({ size: "xs" }), focusRing(), {
    border: 0,
    padding: "2px 4px",
    borderRadius: "4px",
    background: "none",
    color: colors.gray[11],
    cursor: "pointer",
    "&[aria-current='step']": { color: colors.gray[12], fontWeight: 600 },
    "&:hover": { color: colors.gray[12] },
  }),
  body: style({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    minHeight: 0,
  }),
  expandedBody: style({
    flex: 1,
    gridTemplateColumns: "220px minmax(0, 1fr) minmax(0, 1fr)",
    gridTemplateAreas: "'outline stage map'",
  }),
  outline: style({
    gridArea: "outline",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: spacing.value(3),
    overflow: "auto",
    borderRight: `1px solid ${colors.gray[4]}`,
  }),
  outlineItem: style(text({ size: "xs" }), focusRing(), {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    columnGap: spacing.value(2),
    padding: "6px 8px",
    border: 0,
    borderRadius: "6px",
    background: "none",
    color: colors.gray[12],
    textAlign: "left",
    cursor: "pointer",
    "& small": { gridColumn: 1, color: colors.gray[11] },
    "&:hover": { backgroundColor: colors.gray[3] },
    "&[aria-current='step']": { backgroundColor: colors.accent[3] },
  }),
  stage: style({
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    backgroundColor: colors.gray[2],
  }),
  expandedStage: style({
    gridArea: "stage",
    overflow: "auto",
    borderLeft: `1px solid ${colors.gray[4]}`,
  }),
  controls: style(spacing.padding({ x: 6, y: 3 }), {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "start",
    gap: spacing.value(3),
    borderTop: `1px solid ${colors.gray[4]}`,
    backgroundColor: colors.gray[1],
  }),
  note: style(text({ size: "xs", color: "lowContrast" }), {
    gridColumn: "1 / -1",
    margin: 0,
  }),
  actions: style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.value(2),
  }),
  strip: style(spacing.padding({ all: 4 }), {
    display: "flex",
    gap: spacing.value(3),
    overflowX: "auto",
    borderTop: `1px solid ${colors.gray[4]}`,
  }),
  map: style({
    gridArea: "map",
    position: "relative",
    display: "block",
    padding: 0,
    overflow: "auto",
    border: 0,
    borderLeft: `1px solid ${colors.gray[4]}`,
  }),
  thumb: style(radius.md, shadow.subtle, focusRing(), {
    flex: "0 0 168px",
    display: "flex",
    flexDirection: "column",
    padding: 0,
    border: 0,
    overflow: "hidden",
    backgroundColor: colors.gray[1],
    cursor: "pointer",
    textAlign: "left",
    "&[aria-current='step']": { boxShadow: `0 0 0 2px ${colors.accent[9]}` },
  }),
  mapCard: style({
    position: "absolute",
    width: `${MAP_CARD.width}px`,
    height: `${MAP_CARD.height}px`,
    margin: spacing.value(8),
  }),
  thumbFrame: style({ height: "104px", overflow: "hidden", flexShrink: 0 }),
  mapFrame: style({ height: `${MAP_CARD.height - 36}px` }),
  thumbLabel: style(
    text({ size: "xs", fontWeight: 500 }),
    spacing.padding({ x: 4, y: 2 }),
    {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.value(2),
      minHeight: "32px",
      borderTop: `1px solid ${colors.gray[4]}`,
      color: colors.gray[12],
    },
  ),
  edges: style({
    position: "absolute",
    inset: spacing.value(8),
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
    "& path": { fill: "none", stroke: colors.gray[7], strokeWidth: 1.5 },
    "& path[data-active]": { stroke: colors.accent[9], strokeWidth: 2 },
  }),
};
