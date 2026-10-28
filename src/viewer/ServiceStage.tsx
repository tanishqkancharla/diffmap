import {
  type ReactElement,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "motion/react";
import {
  Text,
  Tooltip,
  backgroundColor,
  colors,
  flex,
  focusRing,
  radius,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { SourceNavigation } from "../annotations.js";
import {
  flattenServices,
  type Service,
  type ServiceDiagram,
  type ServiceEvent,
  type ServiceUpdate,
} from "../services.js";
import {
  layoutServices,
  linkId,
  serviceLinks,
  type Point,
  type Rect,
  type ServiceLayout,
  type ServiceLink,
  type Size,
} from "./serviceLayout.js";

export const TRAVEL_MS = 750;
const NOTE_WIDTH = 200;
const NOTE_GAP = 28;

/** A step's note and the element it explains: an event label or a state row. */
type StepNote = {
  id: string;
  text: string;
  target: string;
  /** For a state row, the box whose right edge the leader starts from. */
  service: string | undefined;
};

type State = Map<string, Map<string, string>>;

export type StageProps = {
  diagram: ServiceDiagram;
  state: State;
  previousState: State;
  changed: Set<string>;
  active: Set<string>;
  events: ServiceEvent[];
  updates: ServiceUpdate[];
  phase: "travel" | "settled";
  stepKey: number;
} & SourceNavigation;

/**
 * Lays the services out with ELK, then draws boxes, routes, and the current
 * step's events on top. A hidden copy of every box, filled with its widest
 * values, gives ELK sizes that hold for every step, so nothing moves while
 * the diagram plays.
 */
export function ServiceStage(props: StageProps) {
  const diagram = props.diagram;
  const flat = useMemo(() => flattenServices(diagram.services), [diagram]);
  const links = useMemo(() => serviceLinks(diagram), [diagram]);
  const widest = useMemo(() => widestState(diagram), [diagram]);
  const outer = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<{
    layout: ServiceLayout;
    /** Each link's widest label pill. */
    labels: Map<string, Size>;
    scale: number;
    /** Where the canvas starts, so the diagram is centered. */
    left: number;
    /** Notes stack under the diagram when no column beside it fits. */
    notesBelow: boolean;
  }>();
  // Diagrams with notes keep room for them at every step, so the diagram
  // doesn't move when notes come and go.
  const gutter = useMemo(
    () =>
      diagram.steps.some(
        (step) =>
          step.events.some((event) => event.note !== undefined) ||
          step.updates.some((update) => update.note !== undefined),
      )
        ? NOTE_WIDTH + NOTE_GAP * 2
        : 0,
    [diagram],
  );
  const markerId = useId();

  useLayoutEffect(() => {
    let latest = 0;
    let measuredWidth = -1;
    const place = async (force: boolean) => {
      const available = outer.current!.clientWidth;
      if (!force && available === measuredWidth) return;
      measuredWidth = available;
      const run = ++latest;
      const sizes = new Map(
        [...measure.current!.querySelectorAll("[data-measure-service]")].map(
          (element) => [
            element.getAttribute("data-measure-service")!,
            sizeOf(element),
          ],
        ),
      );
      const label = { width: 0, height: 0 };
      const labels = new Map<string, Size>();
      for (const element of measure.current!.querySelectorAll(
        "[data-measure-link]",
      )) {
        const size = sizeOf(element);
        labels.set(element.getAttribute("data-measure-link")!, size);
        label.width = Math.max(label.width, size.width);
        label.height = Math.max(label.height, size.height);
      }
      const input = { diagram, links, sizes, label };
      const fits = (layout: ServiceLayout) =>
        layout.width + gutter <= available;
      // Left to right reads best; go top to bottom when that fits better.
      const right = await layoutServices({ ...input, direction: "RIGHT" });
      const down = fits(right)
        ? right
        : await layoutServices({ ...input, direction: "DOWN" });
      const best = down.width < right.width ? down : right;
      const scale = Math.min(1, available / best.width);
      const width = best.width * scale;
      const left = (available - width) / 2;
      // The diagram stays centered. Notes sit beside it when the space on its
      // right holds them, and underneath otherwise, so the diagram never
      // shrinks or shifts to make room.
      if (run === latest)
        setPlaced({
          layout: best,
          labels,
          scale,
          left,
          notesBelow: left < gutter,
        });
    };
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns the layout result.
    void place(true);
    // oxlint-disable-next-line typescript/no-floating-promises -- Web fonts change measured sizes.
    void document.fonts.ready.then(() => place(true));
    const observer = new ResizeObserver(() => void place(false));
    observer.observe(outer.current!);
    return () => {
      latest = Number.NaN;
      observer.disconnect();
    };
  }, [diagram, links, gutter]);

  const parents = useMemo(
    () =>
      new Map(flat.map(({ service, parent }) => [service.name, parent?.name])),
    [flat],
  );
  const depth = useMemo(() => {
    const result = new Map<string, number>();
    for (const { service, parent } of flat)
      result.set(
        service.name,
        parent === undefined ? 0 : result.get(parent.name)! + 1,
      );
    return result;
  }, [flat]);

  const stage = useStyles(styles.stage);
  const measureLayer = useStyles(styles.measureLayer);
  const canvas = useStyles(styles.canvas);
  const overlay = useStyles(styles.overlay);
  const box = useStyles(styles.box);
  const pill = useStyles(styles.pill);

  const layout = placed?.layout;
  // Event labels steer clear of these; a parent's box is room for them.
  const leafBoxes =
    layout === undefined
      ? []
      : flat.flatMap(({ service }) =>
          service.children.length === 0
            ? [layout.boxes.get(service.name)!]
            : [],
        );
  // Notes appear once the step's events have landed.
  const settled = props.phase === "settled";
  const notes = useMemo(
    (): StepNote[] =>
      settled
        ? [
            ...props.events.flatMap((event, index) =>
              event.note === undefined
                ? []
                : [
                    {
                      id: `event-${index}`,
                      text: event.note,
                      target: `[data-event-label="${index}"]`,
                      service: undefined,
                    },
                  ],
            ),
            ...props.updates.flatMap((update, index) =>
              update.note === undefined
                ? []
                : [
                    {
                      id: `update-${index}`,
                      text: update.note,
                      target: `[data-state-row="${update.service}.${update.key}"]`,
                      service: update.service,
                    },
                  ],
            ),
          ]
        : [],
    [settled, props.events, props.updates],
  );
  const notesX =
    placed === undefined
      ? 0
      : placed.left + placed.layout.width * placed.scale + NOTE_GAP;
  const canvasRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef(new Map<string, HTMLElement>());
  const [noteLayout, setNoteLayout] = useState<{
    /** `n` numbers notes that sit under the diagram, away from their target. */
    items: Map<string, { top: number; from: Point; n: number }>;
    bottom: number;
  }>();

  // Line each note up with its target, pushing notes down so none overlap.
  useLayoutEffect(() => {
    if (placed === undefined || notes.length === 0) return;
    const origin = outer.current!.getBoundingClientRect();
    const measured = notes
      .map((note) => {
        const target = canvasRef
          .current!.querySelector(note.target)!
          .getBoundingClientRect();
        const owner =
          note.service === undefined
            ? undefined
            : placed.layout.boxes.get(note.service)!;
        // Event leaders start at the label; state leaders at the box edge.
        const x =
          owner === undefined
            ? target.right - origin.left
            : placed.left + (owner.x + owner.width) * placed.scale;
        return {
          id: note.id,
          from: { x, y: target.top - origin.top + target.height / 2 },
          height: noteRefs.current.get(note.id)!.offsetHeight,
        };
      })
      .toSorted((a, b) => a.from.y - b.from.y);
    const items = new Map<string, { top: number; from: Point; n: number }>();
    let bottom = placed.notesBelow
      ? placed.layout.height * placed.scale + 8
      : Number.NEGATIVE_INFINITY;
    for (const [index, note] of measured.entries()) {
      const top = placed.notesBelow
        ? bottom + 8
        : Math.max(note.from.y - 12, bottom + 8);
      items.set(note.id, { top, from: note.from, n: index + 1 });
      bottom = top + note.height;
    }
    setNoteLayout({ items, bottom });
  }, [notes, placed]);

  const noteClass = useStyles(styles.note);
  const noteLines = useStyles(styles.noteLines);
  const noteNumber = useStyles(styles.noteNumber);
  const height =
    layout === undefined
      ? 120
      : Math.max(
          layout.height * placed!.scale,
          notes.length > 0 && noteLayout !== undefined
            ? noteLayout.bottom + 4
            : 0,
        );
  return (
    <div ref={outer} className={stage} style={{ height }}>
      <div ref={measure} className={measureLayer} aria-hidden="true" inert>
        {flat.map(({ service }) => (
          <section
            key={service.name}
            className={box}
            data-measure-service={service.name}
          >
            <ServiceCard
              {...props}
              service={service}
              values={widest.get(service.name)!}
              previous={undefined}
              changed={new Set()}
            />
          </section>
        ))}
        {links.map(
          (link) =>
            link.label !== undefined && (
              <div key={link.id} className={pill} data-measure-link={link.id}>
                {link.label}
              </div>
            ),
        )}
      </div>
      {layout !== undefined && (
        <div
          ref={canvasRef}
          className={canvas}
          style={{
            left: placed!.left,
            width: layout.width,
            height: layout.height,
            transform: `scale(${placed!.scale})`,
          }}
        >
          {flat.map(({ service }) => {
            const rect = layout.boxes.get(service.name)!;
            return (
              <section
                key={service.name}
                className={box}
                data-depth={depth.get(service.name)}
                data-active={props.active.has(service.name)}
                aria-label={service.name}
                style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                  height: rect.height,
                }}
              >
                <ServiceCard
                  {...props}
                  service={service}
                  values={props.state.get(service.name)!}
                  previous={props.previousState.get(service.name)!}
                />
              </section>
            );
          })}
          <svg
            className={overlay}
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            <defs>
              {(["idle", "active"] as const).map((kind) => (
                <marker
                  key={kind}
                  id={`${markerId}-${kind}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M0,1 L9,5 L0,9 z"
                    style={{
                      fill:
                        kind === "active" ? colors.accent[9] : colors.gray[8],
                    }}
                  />
                </marker>
              ))}
            </defs>
            {links.map((link) => {
              const route = trimmedRoute(layout, link, parents);
              const sending = (from: string, to: string) =>
                props.events.some(
                  (event) => event.from === from && event.to === to,
                );
              const forward = sending(link.a, link.b);
              const backward = sending(link.b, link.a);
              const marker = (active: boolean) =>
                `url(#${markerId}-${active ? "active" : "idle"})`;
              return (
                <path
                  key={link.id}
                  d={polyline(route)}
                  fill="none"
                  markerEnd={link.forward ? marker(forward) : undefined}
                  markerStart={link.backward ? marker(backward) : undefined}
                  style={{
                    stroke:
                      forward || backward ? colors.accent[9] : colors.gray[7],
                    strokeWidth: forward || backward ? 2 : 1,
                    strokeDasharray: forward || backward ? undefined : "4 4",
                  }}
                />
              );
            })}
          </svg>
          {props.events.map((event, index) => {
            const id = linkId(event.from, event.to);
            const link = links.find((candidate) => candidate.id === id)!;
            const route = trimmedRoute(layout, link, parents);
            // Replies travel the shared route backward.
            const points = event.from === link.a ? route : route.toReversed();
            const twin = props.events
              .slice(0, index)
              .filter((other) => linkId(other.from, other.to) === id).length;
            // A service talking to itself loops off its side; label its corner.
            const self =
              link.a === link.b ? layout.boxes.get(link.a) : undefined;
            // A link along the canvas edge would push half its label off it.
            const size = placed!.labels.get(id);
            const half = (size?.width ?? 0) / 2;
            const middle = labelPoint(route, size, leafBoxes);
            const at =
              self === undefined
                ? {
                    x: Math.min(Math.max(middle.x, half), layout.width - half),
                    y: middle.y,
                  }
                : { x: self.x + self.width - 8, y: self.y };
            return (
              <EventMarks
                key={`${props.stepKey}-${index}`}
                {...props}
                event={event}
                points={points}
                label={{ x: at.x, y: at.y + twin * 22 }}
                anchor={self === undefined ? "center" : "end"}
                index={index}
              />
            );
          })}
        </div>
      )}
      {notes.length > 0 && (
        <>
          <svg className={noteLines} aria-hidden="true">
            {notes.map((note) => {
              const item = noteLayout?.items.get(note.id);
              if (item === undefined) return undefined;
              const y = item.top + 12;
              if (placed?.notesBelow)
                return (
                  <g key={`${props.stepKey}-${note.id}`}>
                    <circle cx={item.from.x} cy={item.from.y} r={7} />
                    <text x={item.from.x} y={item.from.y}>
                      {item.n}
                    </text>
                  </g>
                );
              return (
                <g key={`${props.stepKey}-${note.id}`}>
                  <circle cx={item.from.x} cy={item.from.y} r={2.5} />
                  <path
                    d={`M${item.from.x},${item.from.y} H${notesX - 12} V${y} H${notesX}`}
                    fill="none"
                  />
                </g>
              );
            })}
          </svg>
          {notes.map((note) => {
            const item = noteLayout?.items.get(note.id);
            return (
              <motion.div
                key={`${props.stepKey}-${note.id}`}
                ref={(element) => {
                  if (element === null) noteRefs.current.delete(note.id);
                  else noteRefs.current.set(note.id, element);
                }}
                className={noteClass}
                data-below={placed?.notesBelow}
                style={{
                  left: placed?.notesBelow ? 0 : notesX,
                  top: item?.top ?? 0,
                  visibility: item === undefined ? "hidden" : "visible",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {placed?.notesBelow && item !== undefined && (
                  <span className={noteNumber}>{item.n}</span>
                )}
                {note.text}
              </motion.div>
            );
          })}
        </>
      )}
    </div>
  );
}

function EventMarks(
  props: {
    event: ServiceEvent;
    points: Point[];
    label: Point;
    anchor: "center" | "end";
    index: number;
    phase: StageProps["phase"];
  } & SourceNavigation,
) {
  const packet = useStyles(styles.packet);
  const labelAnchor = useStyles(styles.labelAnchor);
  const pill = useStyles(styles.pill);
  const annotation = props.event.annotation;
  const label = props.event.label === "" ? undefined : props.event.label;
  const lengths = cumulativeLengths(props.points);
  const total = lengths.at(-1)! || 1;
  return (
    <>
      {props.phase === "travel" && (
        <motion.div
          className={packet}
          initial={{ x: props.points[0]!.x, y: props.points[0]!.y }}
          animate={{
            x: props.points.map((point) => point.x),
            y: props.points.map((point) => point.y),
          }}
          // Even speed along every segment of the route.
          transition={{
            duration: TRAVEL_MS / 1000,
            ease: "easeInOut",
            times: lengths.map((length) => length / total),
          }}
        />
      )}
      {(label !== undefined || props.event.note !== undefined) && (
        <motion.div
          className={labelAnchor}
          style={{ left: props.label.x, top: props.label.y }}
          data-anchor={props.anchor}
          data-event-label={props.index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {label !== undefined &&
            (annotation === undefined ? (
              <div className={pill}>{label}</div>
            ) : (
              <button
                type="button"
                className={pill}
                aria-pressed={props.selectedAnnotation === annotation}
                aria-controls="source-diff-panel"
                aria-label={`Open source: ${annotation.text}`}
                onClick={() => props.onSelectAnnotation(annotation)}
              >
                {label} ↗
              </button>
            ))}
        </motion.div>
      )}
    </>
  );
}

/** A service's header and state, without its sub-services. */
function ServiceCard(
  props: {
    service: Service;
    values: Map<string, string>;
    previous: Map<string, string> | undefined;
    changed: Set<string>;
  } & SourceNavigation,
) {
  const service = props.service;
  const header = useStyles(styles.header);
  const headerButton = useStyles(styles.header, styles.headerButton);
  const stateList = useStyles(styles.stateList);
  const stateRow = useStyles(styles.stateRow);
  const annotation = service.annotation;
  const described = service.description !== undefined;
  const title = (
    <>
      {/* Keep the source arrow beside the name when the label wraps. */}
      <Text
        size="sm"
        fontWeight={600}
        style={{ whiteSpace: "nowrap" }}
        data-described={described}
      >
        {service.name}
        {annotation !== undefined && (
          <Text size="xs" color="accent" aria-hidden="true">
            {" ↗"}
          </Text>
        )}
      </Text>
      {service.label !== undefined && (
        <Text size="xs" color="lowContrast">
          {service.label}
        </Text>
      )}
    </>
  );
  return (
    <>
      <Described description={service.description}>
        {annotation === undefined ? (
          <div className={header} tabIndex={described ? 0 : undefined}>
            {title}
          </div>
        ) : (
          <button
            type="button"
            className={headerButton}
            aria-pressed={props.selectedAnnotation === annotation}
            aria-controls="source-diff-panel"
            aria-label={`Open source: ${service.name}`}
            onClick={() => props.onSelectAnnotation(annotation)}
          >
            {title}
          </button>
        )}
      </Described>
      {service.state.length > 0 && (
        <dl
          className={stateList}
          style={{
            ["--key-width" as string]: `${Math.max(...service.state.map(({ key }) => key.length))}ch`,
          }}
        >
          {service.state.map(({ key, description }) => {
            const changed = props.changed.has(`${service.name}.${key}`);
            return (
              <div
                key={key}
                className={stateRow}
                data-changed={changed}
                data-state-row={`${service.name}.${key}`}
              >
                <Described description={description}>
                  <dt
                    tabIndex={description === undefined ? undefined : 0}
                    data-described={description !== undefined}
                  >
                    {key}
                  </dt>
                </Described>
                <dd>
                  {changed && (
                    <Text size="xs" monospace color="lowContrast">
                      <s>{props.previous?.get(key)}</s>{" "}
                    </Text>
                  )}
                  <Text
                    size="xs"
                    monospace
                    color={changed ? "accent" : undefined}
                  >
                    {props.values.get(key)}
                  </Text>
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </>
  );
}

/** Shows `description` in a tooltip on its child, when there is one. */
export function Described(props: {
  description: string | undefined;
  children: ReactElement;
}) {
  if (props.description === undefined) return props.children;
  return (
    <Tooltip content={props.description} placement="top">
      {props.children}
    </Tooltip>
  );
}

/**
 * Each state value at its widest, including the struck-through old value a
 * changed row shows beside the new one.
 */
function widestState(diagram: ServiceDiagram) {
  const current = new Map(
    flattenServices(diagram.services).map(({ service }) => [
      service.name,
      new Map(service.state.map((entry) => [entry.key, entry.value])),
    ]),
  );
  const widest = new Map(
    [...current].map(([name, values]) => [name, new Map(values)]),
  );
  for (const step of diagram.steps)
    for (const update of step.updates) {
      const values = current.get(update.service)!;
      const shown = `${values.get(update.key)} ${update.value}`;
      const best = widest.get(update.service)!;
      if (shown.length > best.get(update.key)!.length)
        best.set(update.key, shown);
      values.set(update.key, update.value);
    }
  return widest;
}

function isAncestor(
  parents: Map<string, string | undefined>,
  ancestor: string,
  name: string,
) {
  for (let at = parents.get(name); at !== undefined; at = parents.get(at))
    if (at === ancestor) return true;
  return false;
}

/**
 * ELK starts a parent-to-child route at the parent's border, which crosses
 * the parent's own header and state; start it below them instead.
 */
function trimmedRoute(
  layout: ServiceLayout,
  link: ServiceLink,
  parents: Map<string, string | undefined>,
): Point[] {
  const route = layout.routes.get(link.id)!;
  if (!isAncestor(parents, link.a, link.b)) return route;
  const parent = layout.boxes.get(link.a)!;
  const bottom = parent.y + layout.sizes.get(link.a)!.height;
  const [start, next] = route;
  if (next === undefined || start!.x !== next.x || next.y <= bottom)
    return route;
  return [{ x: start!.x, y: bottom }, ...route.slice(1)];
}

function sizeOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
}

function polyline(points: Point[]) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
}

function cumulativeLengths(points: Point[]) {
  let total = 0;
  return points.map((point, index) => {
    const before = points[index - 1];
    if (before !== undefined)
      total += Math.hypot(point.x - before.x, point.y - before.y);
    return total;
  });
}

/** The middle of the route's longest segment, usually the gap between layers. */
/** The middle of the longest segment whose label clears every leaf box. */
function labelPoint(
  points: Point[],
  label: Size | undefined,
  boxes: Rect[],
): Point {
  const middles = points
    .slice(1)
    .map((to, index) => {
      const from = points[index]!;
      return {
        length: Math.hypot(to.x - from.x, to.y - from.y),
        at: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
      };
    })
    .toSorted((a, b) => b.length - a.length);
  const clear =
    label === undefined
      ? undefined
      : middles.find(({ at }) =>
          boxes.every(
            (box) =>
              Math.abs(at.x - (box.x + box.width / 2)) >=
                (box.width + label.width) / 2 ||
              Math.abs(at.y - (box.y + box.height / 2)) >=
                (box.height + label.height) / 2,
          ),
        );
  return (clear ?? middles[0])?.at ?? points[0]!;
}

const described = {
  "&[data-described='true']": {
    textDecorationLine: "underline",
    textDecorationStyle: "dotted" as const,
    textDecorationColor: colors.gray[8],
    textUnderlineOffset: "3px",
    cursor: "help",
  },
};

const styles = {
  stage: style({ position: "relative", minWidth: 0, overflow: "hidden" }),
  // Lays out every box at its natural size without showing or taking space.
  measureLayer: style({
    position: "absolute",
    width: 0,
    height: 0,
    overflow: "hidden",
    visibility: "hidden",
    "& > [data-measure-service]": {
      position: "absolute",
      width: "max-content",
      minWidth: 120,
      maxWidth: 240,
    },
    "& > [data-measure-link]": { position: "absolute", width: "max-content" },
  }),
  canvas: style({
    position: "absolute",
    top: 0,
    transformOrigin: "0 0",
  }),
  noteLines: style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
    "& path": { stroke: colors.accent[7], strokeWidth: 1 },
    "& circle": { fill: colors.accent[9] },
    "& text": {
      fill: backgroundColor.app,
      fontSize: 9,
      fontWeight: 600,
      textAnchor: "middle",
      dominantBaseline: "central",
    },
  }),
  noteNumber: style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 14,
    height: 14,
    marginRight: 6,
    borderRadius: "50%",
    fontSize: 9,
    fontWeight: 600,
    verticalAlign: "1px",
    color: backgroundColor.app,
    backgroundColor: colors.accent[9],
  }),
  overlay: style({
    position: "absolute",
    inset: 0,
    overflow: "visible",
    pointerEvents: "none",
  }),
  box: style(radius.md, {
    position: "absolute",
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${colors.gray[6]}`,
    backgroundColor: backgroundColor.element,
    "&[data-depth='1'], &[data-depth='3']": {
      backgroundColor: colors.gray[2],
    },
    "&[data-active='true']": { borderColor: colors.accent[8] },
  }),
  header: style(
    flex({ direction: "row", alignItems: "baseline", gap: 3, wrap: true }),
    spacing.padding({ x: 4, y: 3 }),
    focusRing(),
    {
      minWidth: 0,
      "& > [data-described]": described["&[data-described='true']"],
    },
  ),
  headerButton: style({
    width: "100%",
    border: 0,
    background: "transparent",
    font: "inherit",
    color: "inherit",
    textAlign: "start",
    cursor: "pointer",
    borderRadius: "inherit",
    "&:hover": { backgroundColor: backgroundColor.elementHover },
    "&[aria-pressed='true']": { backgroundColor: colors.blue[3] },
  }),
  // Keys line up in a column; a value too long to sit beside its key wraps
  // below it instead of squeezing to a sliver.
  stateList: style(text({ size: "xs", monospace: true }), {
    margin: 0,
    paddingInline: spacing.value(4),
    paddingBottom: spacing.value(3),
    "& dt": {
      flex: "none",
      minWidth: "min(var(--key-width), 100%)",
      color: colors.gray[11],
    },
    "& dt[data-described='true']": described["&[data-described='true']"],
    "& dt:focus-visible": { outline: `2px solid ${colors.blueAlpha[8]}` },
    "& dd": {
      flex: "1 1 auto",
      margin: 0,
      minWidth: 0,
      overflowWrap: "anywhere",
    },
  }),
  stateRow: style(radius.xs, {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: spacing.value(4),
    paddingInline: spacing.value(2),
    marginInline: `-${spacing.value(2)}`,
    "&[data-changed='true']": { backgroundColor: colors.accentAlpha[3] },
  }),
  packet: style(radius.circle, {
    position: "absolute",
    top: -6,
    left: -6,
    width: 12,
    height: 12,
    backgroundColor: colors.accent[9],
    boxShadow: `0 0 0 3px ${colors.accentAlpha[5]}`,
    pointerEvents: "none",
    zIndex: 2,
  }),
  labelAnchor: style({
    position: "absolute",
    zIndex: 1,
    transform: "translate(-50%, -50%)",
    "&[data-anchor='end']": { transform: "translate(-100%, -50%)" },
  }),
  pill: style(
    radius.pill,
    text({ size: "xs", monospace: true }),
    spacing.padding({ x: 3 }),
    {
      display: "block",
      maxWidth: 220,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      border: `1px solid ${colors.accent[7]}`,
      backgroundColor: backgroundColor.app,
      color: colors.accent[11],
      "&:is(button)": { cursor: "pointer" },
      "&:is(button):hover": { backgroundColor: colors.accent[3] },
      "&[aria-pressed='true']": { backgroundColor: colors.blue[3] },
    },
    focusRing(),
  ),
  // In the column right of the diagram, joined to its target by a leader.
  note: style(
    text({ size: "xs" }),
    radius.sm,
    spacing.padding({ x: 4, y: 2 }),
    {
      position: "absolute",
      width: "max-content",
      maxWidth: NOTE_WIDTH,
      border: `1px solid ${colors.accent[7]}`,
      backgroundColor: backgroundColor.app,
      // Under the diagram: centered, and wider since there is room.
      "&[data-below='true']": {
        right: 0,
        marginInline: "auto",
        maxWidth: "min(100%, 420px)",
      },
    },
  ),
};
