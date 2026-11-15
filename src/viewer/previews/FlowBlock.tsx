import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ActivityIndicator,
  ArrowLeft,
  ArrowRight,
  Button,
  Check,
  ChevronDown,
  ChevronRight,
  Close,
  LayoutRight,
  Maximize,
  Menu,
  MenuItem,
  MenuTrigger,
  colors,
  focusRing,
  radius,
  shadow,
  spacing,
  text,
  Tooltip,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { FlowState } from "../../parseFence.js";
import type { PreviewStoryInfo } from "../../preview/protocol.js";
import { fenceTitle, pierreShell } from "../pierre.js";
import { ReviewedCheckbox } from "../ReviewedCheckbox.tsx";
import { storyLabel, storyLabelFromId, useDiffmapConfig } from "./config.ts";
import {
  layoutFlow,
  stateAncestry,
  stateChildren,
  statePath,
} from "./flowTree.ts";
import { usePreviewPage } from "./PreviewBlock.tsx";
import { PreviewFrame, type FrameRequest } from "./PreviewFrame.tsx";
import { useReviewedStates } from "./reviewedStates.ts";

/** Thumbnails render the app this wide, then scale down, so they show the layout a reader sees at full size. */
const THUMBNAIL_RENDER_WIDTH = 720;
const PEEK_WIDTH = 248;
const PEEK_GAP = 8;
/** Keeps a card for a state near the bottom of the window from opening below it. */
const PEEK_MIN_ROOM = 300;
const MAP_CARD = { width: 152, height: 128, gapX: 32, gapY: 16 };

/**
 * A `flow` fence: one live frame of the app moving through a user journey, with the viewer's controls around it.
 * Expanding fixes the same frame to the window with the states beside it as the only way around the flow, so the
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [warm, setWarm] = useState(false);
  const [peek, setPeek] = useState<{
    index: number;
    top: number;
    left: number;
  }>();
  const peekOpen = useRef(false);
  const peekTimer = useRef<number | undefined>(undefined);
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
    if (!expanded) return;
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
      behavior: "instant",
    });
  }, [selected, expanded]);

  useEffect(() => {
    if (peek === undefined) return;
    const onScroll = () => {
      window.clearTimeout(peekTimer.current);
      peekOpen.current = false;
      setPeek(undefined);
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [peek]);

  const layout = layoutFlow(states);
  const ancestry = stateAncestry(states, selected);
  const children = stateChildren(states, selected);
  const parent = states[selected]!.parent;
  const playing = catalog !== undefined && reached !== selected;
  const note = catalog?.get(states[selected]!.story)?.description;

  const stateReviewed = (index: number) =>
    isReviewed(reviewKey(index), fingerprints[states[index]!.story]);
  const markReviewed = (index: number, value: boolean) => {
    const print = fingerprints[states[index]!.story];
    if (print !== undefined) setReviewed(reviewKey(index), print, value);
  };

  const showPeek = (index: number, row: HTMLElement) => {
    const at = row.getBoundingClientRect();
    const sidebar = row
      .closest("[data-states-sidebar]")!
      .getBoundingClientRect();
    const right = sidebar.right + PEEK_GAP;
    const left =
      right + PEEK_WIDTH <= window.innerWidth - PEEK_GAP
        ? right
        : sidebar.left - PEEK_GAP - PEEK_WIDTH;
    const top = Math.max(
      PEEK_GAP,
      Math.min(at.top, window.innerHeight - PEEK_MIN_ROOM),
    );
    setWarm(true);
    window.clearTimeout(peekTimer.current);
    if (peekOpen.current) {
      setPeek({ index, top, left });
      return;
    }
    peekTimer.current = window.setTimeout(() => {
      peekOpen.current = true;
      setPeek({ index, top, left });
    }, 300);
  };
  const hidePeek = () => {
    window.clearTimeout(peekTimer.current);
    peekOpen.current = false;
    setPeek(undefined);
  };

  const wrapperClass = useStyles(styles.wrapper);
  const scrim = useStyles(styles.scrim);
  const card = useStyles(
    pierreShell,
    styles.card,
    expanded && styles.expandedCard,
  );
  const header = useStyles(fenceTitle, styles.header);
  const crumbs = useStyles(styles.crumbs);
  const crumbStep = useStyles(styles.crumbStep);
  const crumb = useStyles(styles.crumb);
  const body = useStyles(
    styles.body,
    !expanded && sidebarOpen && styles.bodyWithSidebar,
    expanded && styles.expandedBody,
  );
  const stage = useStyles(styles.stage, expanded && styles.expandedStage);
  const controls = useStyles(styles.controls);
  const noteClass = useStyles(styles.note);
  const actions = useStyles(styles.actions);
  const endNote = useStyles(styles.endNote);
  const sidebar = useStyles(styles.sidebar);
  const outline = useStyles(styles.outline);
  const outlineItem = useStyles(styles.outlineItem);
  const outlineLabel = useStyles(styles.outlineLabel);
  const guides = useStyles(styles.guides);
  const guide = useStyles(styles.guide);
  const peekCard = useStyles(styles.peekCard);
  const peekFrames = useStyles(styles.peekFrames);
  const peekFrame = useStyles(styles.peekFrame);
  const map = useStyles(styles.map);
  const mapCard = useStyles(styles.mapCard);
  const thumbFrame = useStyles(styles.thumbFrame);
  const thumbLabel = useStyles(styles.thumbLabel);
  const thumbHit = useStyles(styles.thumbHit);
  const thumbReview = useStyles(styles.thumbReview);
  const reviewedMark = useStyles(styles.reviewedMark);
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

  const mapPosition = (index: number): CSSProperties => ({
    position: "absolute",
    left: `calc(${layout.placements[index]!.column * (MAP_CARD.width + MAP_CARD.gapX)}px + ${spacing.value(6)})`,
    top: `calc(${layout.placements[index]!.row * (MAP_CARD.height + MAP_CARD.gapY)}px + ${spacing.value(6)})`,
  });
  const mapWidth =
    layout.columns * (MAP_CARD.width + MAP_CARD.gapX) - MAP_CARD.gapX;
  const mapHeight =
    layout.rows * (MAP_CARD.height + MAP_CARD.gapY) - MAP_CARD.gapY;

  const stateCard = (index: number, position?: CSSProperties) => {
    const state = states[index]!;
    const reviewed = stateReviewed(index);
    return (
      <div
        key={state.story}
        className={mapCard}
        data-state={index}
        aria-current={index === selected ? "step" : undefined}
        style={position}
      >
        <div className={thumbFrame} data-reviewed={reviewed}>
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
        {reviewed && (
          <div
            className={reviewedMark}
            role="img"
            aria-label={`Reviewed: ${label(index)}`}
          >
            <Check size="sm" />
          </div>
        )}
        <div className={thumbLabel}>{state.action ?? "Start"}</div>
        <button
          type="button"
          className={thumbHit}
          aria-label={label(index)}
          onClick={() => select(index)}
        />
        <div
          className={thumbReview}
          role="group"
          aria-label={`Review ${label(index)}`}
        >
          <ReviewedCheckbox
            isSelected={reviewed}
            onChange={(value) => markReviewed(index, value)}
          />
        </div>
      </div>
    );
  };

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
          {!expanded && (
            <Tooltip content={sidebarOpen ? "Hide states" : "Show states"}>
              <Button
                size="sm"
                variant="quiet"
                aria-label={sidebarOpen ? "Hide states" : "Show states"}
                aria-pressed={sidebarOpen}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <LayoutRight size="xs" />
              </Button>
            </Tooltip>
          )}
        </figcaption>
        <div className={body}>
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
              <Button
                size="sm"
                isDisabled={parent === undefined}
                onClick={() => parent !== undefined && select(parent)}
              >
                <ArrowLeft size="xs" />
                Back
              </Button>
              <div className={actions}>
                {children.length === 0 ? (
                  <span className={endNote}>End of this path</span>
                ) : (
                  <NextStep
                    steps={children.map((child) => ({
                      index: child,
                      action: states[child]!.action!,
                    }))}
                    onSelect={select}
                  />
                )}
              </div>
            </div>
          </div>
          {expanded ? (
            <div ref={stripRef} className={map}>
              <div
                aria-hidden
                style={{
                  width: `calc(${mapWidth}px + 2 * ${spacing.value(6)})`,
                  height: `calc(${mapHeight}px + 2 * ${spacing.value(6)})`,
                }}
              />
              <svg className={edges} aria-hidden>
                {states.map((state, index) => {
                  if (state.parent === undefined) return undefined;
                  const from = layout.placements[state.parent]!;
                  const to = layout.placements[index]!;
                  const x1 =
                    from.column * (MAP_CARD.width + MAP_CARD.gapX) +
                    MAP_CARD.width;
                  const y1 =
                    from.row * (MAP_CARD.height + MAP_CARD.gapY) +
                    MAP_CARD.height / 2;
                  const x2 = to.column * (MAP_CARD.width + MAP_CARD.gapX);
                  const y2 =
                    to.row * (MAP_CARD.height + MAP_CARD.gapY) +
                    MAP_CARD.height / 2;
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
              {states.map((_, index) => stateCard(index, mapPosition(index)))}
            </div>
          ) : (
            sidebarOpen && (
              <div
                className={sidebar}
                data-states-sidebar
                onPointerEnter={() => setWarm(true)}
              >
                <nav
                  className={outline}
                  aria-label="Every state"
                  onPointerLeave={hidePeek}
                >
                  {states.map((state, index) => {
                    const path = stateAncestry(states, index);
                    return (
                      <div
                        key={state.story}
                        className={outlineItem}
                        aria-current={index === selected ? "step" : undefined}
                        data-on-path={ancestry.includes(index) || undefined}
                        onPointerEnter={(event) =>
                          showPeek(index, event.currentTarget)
                        }
                      >
                        <span className={guides} aria-hidden>
                          {path.slice(1).map((node, level) => (
                            <span
                              key={node}
                              className={guide}
                              data-elbow={
                                level === path.length - 2 || undefined
                              }
                              data-continued={
                                hasLaterSibling(states, node) || undefined
                              }
                            />
                          ))}
                        </span>
                        <button
                          type="button"
                          className={outlineLabel}
                          aria-current={index === selected ? "step" : undefined}
                          onClick={() => select(index)}
                          onFocus={(event) =>
                            showPeek(index, event.currentTarget.parentElement!)
                          }
                          onBlur={hidePeek}
                        >
                          {label(index)}
                        </button>
                        <ReviewedCheckbox
                          isSelected={stateReviewed(index)}
                          isDisabled={fingerprints[state.story] === undefined}
                          onChange={(value) => markReviewed(index, value)}
                        />
                      </div>
                    );
                  })}
                </nav>
                {warm &&
                  catalog !== undefined &&
                  createPortal(
                    <div
                      className={peekCard}
                      data-open={peek !== undefined || undefined}
                      style={{ top: peek?.top ?? 0, left: peek?.left ?? 0 }}
                      aria-hidden
                    >
                      <div className={peekFrames}>
                        {states.map((state, index) => (
                          <div
                            key={state.story}
                            className={peekFrame}
                            data-shown={index === peek?.index || undefined}
                          >
                            <PreviewFrame
                              page={page.url}
                              initialPath={statePath(states, index)}
                              mode="thumbnail"
                              renderWidth={THUMBNAIL_RENDER_WIDTH}
                              maxHeight={140}
                              label={label(index)}
                              onState={(next) =>
                                setFingerprints((current) => ({
                                  ...current,
                                  [state.story]: next.fingerprint,
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                      {peek !== undefined && (
                        <>
                          <strong>{label(peek.index)}</strong>
                          {catalog.get(states[peek.index]!.story)
                            ?.description !== undefined && (
                            <span data-description>
                              {
                                catalog.get(states[peek.index]!.story)!
                                  .description
                              }
                            </span>
                          )}
                        </>
                      )}
                    </div>,
                    document.body,
                  )}
              </div>
            )
          )}
        </div>
      </figure>
    </div>
  );
}

function hasLaterSibling(states: FlowState[], index: number): boolean {
  const parent = states[index]!.parent;
  return states.some(
    (state, other) => other > index && state.parent === parent,
  );
}

/** The next step down the path the fence lists first, with the state's other steps in a menu beside it. */
function NextStep(props: {
  steps: { index: number; action: string }[];
  onSelect: (index: number) => void;
}) {
  const [first, ...rest] = props.steps;
  const segmented = useStyles(styles.segmented);
  return (
    <div className={segmented}>
      <Button
        size="sm"
        variant="primary"
        onClick={() => props.onSelect(first!.index)}
      >
        {first!.action}
        <ArrowRight size="xs" />
      </Button>
      {rest.length > 0 && (
        <MenuTrigger placement="bottom end">
          <Button
            size="sm"
            variant="primary"
            aria-label={`${rest.length} other next ${rest.length === 1 ? "step" : "steps"}`}
          >
            <ChevronDown size="xs" />
          </Button>
          <Menu onAction={(key) => props.onSelect(Number(key))}>
            {rest.map((step) => (
              <MenuItem key={step.index} id={String(step.index)}>
                {step.action}
              </MenuItem>
            ))}
          </Menu>
        </MenuTrigger>
      )}
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
  bodyWithSidebar: style({
    gridTemplateColumns: "minmax(0, 1fr) 200px",
  }),
  expandedBody: style({
    flex: 1,
    gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
    gridTemplateAreas: "'stage map'",
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
  }),
  controls: style(spacing.padding({ x: 6, y: 4 }), {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: spacing.value(4),
    rowGap: spacing.value(3),
    borderTop: `1px solid ${colors.gray[4]}`,
    backgroundColor: colors.gray[1],
  }),
  note: style(text({ size: "xs", color: "lowContrast" }), {
    flexBasis: "100%",
    lineHeight: 1.5,
  }),
  actions: style({
    display: "flex",
    alignItems: "center",
    gap: spacing.value(2),
    marginLeft: "auto",
  }),
  endNote: style(text({ size: "xs", color: "lowContrast" }), {
    paddingInline: spacing.value(2),
  }),
  segmented: style({
    display: "inline-flex",
    "& > button:not(:last-child)": {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },
    "& > button + button": {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      marginLeft: "1px",
    },
  }),
  peekCard: style(
    text({ size: "xs" }),
    radius.sm,
    shadow.subtle,
    spacing.padding({ x: 2, y: 2 }),
    {
      position: "fixed",
      zIndex: 40,
      width: `${PEEK_WIDTH}px`,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      visibility: "hidden",
      border: `1px solid ${colors.gray[5]}`,
      backgroundColor: colors.gray[1],
      color: colors.gray[12],
      pointerEvents: "none",
      "&[data-open]": { visibility: "visible" },
      "& > strong": { marginTop: spacing.value(1), fontWeight: 600 },
      "& > [data-description]": {
        color: colors.gray[11],
        marginTop: "2px",
        lineHeight: 1.45,
      },
    },
  ),
  peekFrames: style(radius.sm, {
    position: "relative",
    overflow: "hidden",
    border: `1px solid ${colors.gray[4]}`,
  }),
  peekFrame: style({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    visibility: "hidden",
    "&[data-shown]": { position: "relative", visibility: "visible" },
  }),
  sidebar: style({
    position: "relative",
    minWidth: 0,
    borderLeft: `1px solid ${colors.gray[4]}`,
    backgroundColor: colors.gray[1],
  }),
  outline: style({
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    padding: spacing.value(2),
    overflowY: "auto",
  }),
  outlineItem: style(text({ size: "xs" }), {
    display: "flex",
    alignItems: "stretch",
    flexShrink: 0,
    minHeight: "28px",
    paddingInline: "4px 6px",
    borderRadius: "4px",
    color: colors.gray[11],
    "& > label": { alignSelf: "center", flexShrink: 0 },
    "&[data-on-path]": { color: colors.gray[12] },
    "&:hover": { backgroundColor: colors.gray[3] },
    "&[aria-current='step']": {
      backgroundColor: colors.accent[3],
      color: colors.gray[12],
      fontWeight: 600,
    },
  }),
  outlineLabel: style(focusRing(), {
    flex: 1,
    minWidth: 0,
    padding: "0 4px",
    border: 0,
    borderRadius: "4px",
    background: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  guides: style({ display: "inline-flex", flexShrink: 0 }),
  guide: style({
    position: "relative",
    width: "16px",
    flexShrink: 0,
    "&[data-continued]::before": {
      content: "''",
      position: "absolute",
      left: "7px",
      insetBlock: 0,
      borderLeft: `1px solid ${colors.gray[6]}`,
    },
    "&[data-elbow]::after": {
      content: "''",
      position: "absolute",
      left: "7px",
      right: 0,
      top: 0,
      bottom: "50%",
      borderLeft: `1px solid ${colors.gray[6]}`,
      borderBottom: `1px solid ${colors.gray[6]}`,
      borderBottomLeftRadius: "5px",
    },
    "&[data-elbow][data-continued]::after": {
      top: "50%",
      bottom: "auto",
      borderLeft: 0,
      borderBottomLeftRadius: 0,
    },
  }),
  map: style({
    gridArea: "map",
    position: "relative",
    overflow: "auto",
    borderLeft: `1px solid ${colors.gray[4]}`,
    backgroundColor: colors.gray[2],
  }),
  mapCard: style(radius.md, shadow.subtle, {
    position: "relative",
    flexShrink: 0,
    width: `${MAP_CARD.width}px`,
    height: `${MAP_CARD.height}px`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: colors.gray[1],
    "&[aria-current='step']": { boxShadow: `0 0 0 2px ${colors.accent[9]}` },
    "&:has(> button:focus-visible)": {
      boxShadow: `0 0 0 2px ${colors.accent[8]}`,
    },
  }),
  thumbFrame: style({
    height: `${MAP_CARD.height - 36}px`,
    overflow: "hidden",
    flexShrink: 0,
    transition: "opacity 120ms",
    "&[data-reviewed='true']": { opacity: 0.35 },
  }),
  thumbLabel: style(
    text({ size: "xs", fontWeight: 500 }),
    spacing.padding({ x: 3, y: 2 }),
    {
      display: "flex",
      alignItems: "center",
      flex: 1,
      minHeight: 0,
      borderTop: `1px solid ${colors.gray[4]}`,
      color: colors.gray[12],
      lineHeight: 1.25,
    },
  ),
  thumbHit: style({
    position: "absolute",
    inset: 0,
    padding: 0,
    border: 0,
    background: "none",
    cursor: "pointer",
    outline: "none",
  }),
  thumbReview: style({
    position: "absolute",
    top: spacing.value(1),
    right: spacing.value(1),
    zIndex: 1,
    display: "flex",
    padding: "2px",
    borderRadius: "4px",
    backgroundColor: colors.gray[1],
  }),
  reviewedMark: style(radius.circle, shadow.subtle, {
    position: "absolute",
    top: `${(MAP_CARD.height - 36) / 2}px`,
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "32px",
    height: "32px",
    display: "grid",
    placeItems: "center",
    color: "white",
    backgroundColor: colors.green[9],
    pointerEvents: "none",
  }),
  edges: style({
    position: "absolute",
    top: spacing.value(6),
    left: spacing.value(6),
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
    "& path": { fill: "none", stroke: colors.gray[7], strokeWidth: 1.5 },
    "& path[data-active]": { stroke: colors.accent[9], strokeWidth: 2 },
  }),
};
