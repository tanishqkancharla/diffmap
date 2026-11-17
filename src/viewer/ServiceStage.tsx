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
  serviceStateAt,
  type Service,
  type ServiceDiagram,
  type ServiceEvent,
  type ServiceNote,
  type ServiceUpdate,
  type Sign,
} from "../services.js";
import {
  layoutServices,
  linkId,
  pillText,
  serviceLinks,
  type Point,
  type ServiceLayout,
  type ServiceLink,
  type Size,
} from "./serviceLayout.js";

export const TRAVEL_MS = 750;
const NOTE_WIDTH = 200;
const NOTE_GAP = 28;
const MESSAGE_GAP = 6;

/** A step's note and the element it explains: an event label, a state row, or a service. */
type StepNote = {
  id: string;
  text: string;
  target: string;
  /** For a state row or a service, the box whose right edge the leader starts from. */
  service: string | undefined;
};

type State = Map<string, Map<string, string>>;

/** State replayed on each side of a diff; the sides match outside a diff. */
export type SidedState = { today: State; proposed: State };

type Values = { today: Map<string, string>; proposed: Map<string, string> };

export type StageProps = {
  diagram: ServiceDiagram;
  state: SidedState;
  previousState: SidedState;
  changed: Set<string>;
  active: Set<string>;
  events: ServiceEvent[];
  updates: ServiceUpdate[];
  notes: ServiceNote[];
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
  const [scrollLeft, setScrollLeft] = useState(0);
  const [placed, setPlaced] = useState<{
    layout: ServiceLayout;
    /** Each event's wrapped label size. */
    labels: Map<ServiceEvent, Size>;
    overflow: boolean;
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
          step.updates.some((update) => update.note !== undefined) ||
          step.notes.length > 0,
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
      // A vertical route puts its labels beside half of the widest service.
      const serviceWidth = Math.max(
        0,
        ...[...sizes.values()].map((size) => size.width),
      );
      measure.current!.style.setProperty(
        "--label-width",
        `${Math.min(220, Math.max(80, available - serviceWidth / 2 - 56))}px`,
      );
      const labels = new Map<ServiceEvent, Size>();
      for (const element of measure.current!.querySelectorAll(
        "[data-measure-event]",
      )) {
        const [step, event] = element
          .getAttribute("data-measure-event")!
          .split(":")
          .map(Number);
        labels.set(diagram.steps[step!]!.events[event!]!, sizeOf(element));
      }
      const stacks = new Map<string, Size>();
      for (const step of diagram.steps) {
        const groups = new Map<string, Size>();
        for (const event of step.events) {
          const size = labels.get(event);
          if (size === undefined) continue;
          const id = linkId(event.from, event.to);
          const before = groups.get(id);
          groups.set(id, {
            width: Math.max(before?.width ?? 0, size.width),
            height:
              (before === undefined ? 0 : before.height + MESSAGE_GAP) +
              size.height,
          });
        }
        for (const [id, size] of groups) {
          const before = stacks.get(id);
          stacks.set(id, {
            width: Math.max(before?.width ?? 0, size.width),
            height: Math.max(before?.height ?? 0, size.height),
          });
        }
      }
      const input = { diagram, links, sizes, labels: stacks };
      const fits = (layout: ServiceLayout) =>
        layout.width + gutter <= available;
      // Left to right reads best; go top to bottom when that fits better.
      const right = await layoutServices({ ...input, direction: "RIGHT" });
      const down = fits(right)
        ? right
        : await layoutServices({ ...input, direction: "DOWN" });
      const best = down.width < right.width ? down : right;
      // Keep text at its authored font size; oversized graphs can scroll locally.
      const width = best.width;
      const left = Math.max(0, (available - width) / 2);
      // The diagram stays centered. Notes sit beside it when the space on its
      // right holds them, and underneath otherwise, so the diagram never
      // shrinks or shifts to make room.
      if (run === latest)
        setPlaced({
          layout: best,
          labels,
          overflow: width > available,
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
            ...props.notes.map((note, index) => ({
              id: `service-${index}`,
              text: note.text,
              target: `[data-service-header="${note.service}"]`,
              service: note.service,
            })),
          ]
        : [],
    [settled, props.events, props.updates, props.notes],
  );
  const notesX =
    placed === undefined ? 0 : placed.left + placed.layout.width + NOTE_GAP;
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
        const x = placed.notesBelow
          ? owner === undefined
            ? target.left - origin.left + outer.current!.scrollLeft - 10
            : placed.left + owner.x + owner.width + 10
          : owner === undefined
            ? target.right - origin.left + outer.current!.scrollLeft
            : placed.left + owner.x + owner.width;
        return {
          id: note.id,
          from: { x, y: target.top - origin.top + target.height / 2 },
          height: noteRefs.current.get(note.id)!.offsetHeight,
        };
      })
      .toSorted((a, b) => a.from.y - b.from.y);
    const items = new Map<string, { top: number; from: Point; n: number }>();
    let bottom = placed.notesBelow
      ? placed.layout.height + 8
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
          layout.height + 16,
          notes.length > 0 && noteLayout !== undefined
            ? noteLayout.bottom + 4
            : 0,
        );
  return (
    <div
      ref={outer}
      className={stage}
      style={{ height }}
      onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
      tabIndex={placed?.overflow ? 0 : undefined}
      data-diagram-scroll={placed?.overflow || undefined}
      role="region"
      aria-label="Service diagram"
      aria-description={
        placed?.overflow
          ? "Scroll horizontally to see all services. Focus this diagram to scroll with arrow keys."
          : undefined
      }
    >
      {placed?.overflow && (
        <Text
          size="xs"
          color="lowContrast"
          style={{ position: "sticky", left: 0 }}
        >
          Scroll horizontally to see all services.
        </Text>
      )}
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
              values={{
                today: widest.get(service.name)!,
                proposed: widest.get(service.name)!,
              }}
              previous={undefined}
              changed={new Set()}
            />
          </section>
        ))}
        {diagram.steps.flatMap((step, stepIndex) =>
          step.events.map(
            (event, eventIndex) =>
              (event.label !== "" || event.note !== undefined) && (
                <div
                  key={`${stepIndex}:${eventIndex}`}
                  className={pill}
                  data-measure-event={`${stepIndex}:${eventIndex}`}
                >
                  {pillText(event)}
                </div>
              ),
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
          }}
        >
          {flat.map(({ service }) => {
            const rect = layout.boxes.get(service.name)!;
            return (
              <section
                key={service.name}
                className={box}
                data-depth={depth.get(service.name)}
                data-change={service.sign}
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
                  values={valuesOf(props.state, service.name)}
                  previous={valuesOf(props.previousState, service.name)}
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
              {tones.map((tone) => (
                <marker
                  key={tone.id}
                  id={`${markerId}-${tone.id}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M0,1 L9,5 L0,9 z" style={{ fill: tone.head }} />
                </marker>
              ))}
            </defs>
            {links.map((link) => {
              const route = trimmedRoute(layout, link, parents);
              const sending = (from: string, to: string) =>
                props.events.filter(
                  (event) => event.from === from && event.to === to,
                );
              const forward = sending(link.a, link.b);
              const backward = sending(link.b, link.a);
              const active = forward.length > 0 || backward.length > 0;
              // While its events travel, a link takes their sign.
              const tone = toneFor(
                active,
                active ? commonSign([...forward, ...backward]) : link.sign,
              );
              const marker = (sent: ServiceEvent[]) =>
                `url(#${markerId}-${(sent.length > 0 ? tone : toneFor(false, link.sign)).id})`;
              return (
                <path
                  key={link.id}
                  d={polyline(route)}
                  fill="none"
                  markerEnd={link.forward ? marker(forward) : undefined}
                  markerStart={link.backward ? marker(backward) : undefined}
                  style={{
                    stroke: tone.line,
                    strokeWidth: active ? 2 : 1,
                    strokeDasharray: active ? undefined : "4 4",
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
            const preceding = props.events
              .slice(0, index)
              .filter((other) => linkId(other.from, other.to) === id);
            const reserved = layout.labels.get(id);
            const size = placed!.labels.get(event);
            const offset = preceding.reduce((sum, other) => {
              const previousSize = placed!.labels.get(other);
              return (
                sum +
                (previousSize === undefined
                  ? 0
                  : previousSize.height + MESSAGE_GAP)
              );
            }, 0);
            return (
              <EventMarks
                key={`${props.stepKey}-${index}`}
                {...props}
                event={event}
                points={points}
                label={{
                  x: (reserved?.x ?? 0) + (reserved?.width ?? 0) / 2,
                  y: (reserved?.y ?? 0) + offset,
                }}
                width={size?.width}
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
              <div
                key={`${props.stepKey}-${note.id}`}
                ref={(element) => {
                  if (element === null) noteRefs.current.delete(note.id);
                  else noteRefs.current.set(note.id, element);
                }}
                className={noteClass}
                data-below={placed?.notesBelow}
                style={{
                  left: placed?.notesBelow ? 0 : notesX,
                  transform: placed?.notesBelow
                    ? `translateX(${scrollLeft}px)`
                    : undefined,
                  top: item?.top ?? 0,
                  visibility: item === undefined ? "hidden" : "visible",
                }}
              >
                {placed?.notesBelow && item !== undefined && (
                  <span className={noteNumber}>{item.n}</span>
                )}
                {note.text}
              </div>
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
    width: number | undefined;
    index: number;
    phase: StageProps["phase"];
  } & SourceNavigation,
) {
  const packet = useStyles(styles.packet);
  const labelAnchor = useStyles(styles.labelAnchor);
  const pill = useStyles(styles.pill);
  const annotation = props.event.annotation;
  const label = props.event.label === "" ? undefined : pillText(props.event);
  const lengths = cumulativeLengths(props.points);
  const total = lengths.at(-1)! || 1;
  // A step's events leave in order, each when the one before it arrives.
  const delay = props.phase === "travel" ? (props.index * TRAVEL_MS) / 1000 : 0;
  return (
    <>
      {props.phase === "travel" && (
        <motion.div
          className={packet}
          data-change={props.event.sign}
          initial={{ x: props.points[0]!.x, y: props.points[0]!.y, opacity: 0 }}
          animate={{
            x: props.points.map((point) => point.x),
            y: props.points.map((point) => point.y),
            opacity: 1,
          }}
          // Even speed along every segment of the route.
          transition={{
            delay,
            duration: TRAVEL_MS / 1000,
            ease: "easeInOut",
            times: lengths.map((length) => length / total),
            opacity: { delay, duration: 0 },
          }}
        />
      )}
      {(label !== undefined || props.event.note !== undefined) && (
        <motion.div
          className={labelAnchor}
          style={{
            left: props.label.x,
            top: props.label.y,
            width: props.width,
          }}
          data-event-label={props.index}
          initial={{ visibility: "hidden" }}
          animate={{ visibility: "visible" }}
          transition={{ delay, duration: 0 }}
        >
          {label !== undefined &&
            (annotation === undefined ? (
              <div className={pill} data-change={props.event.sign}>
                {label}
              </div>
            ) : (
              <button
                type="button"
                className={pill}
                data-change={props.event.sign}
                aria-pressed={props.selectedAnnotation === annotation}
                aria-controls="source-diff-panel"
                aria-label={`Open source: ${annotation.text}`}
                onClick={() => props.onSelectAnnotation(annotation)}
              >
                {label}
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
    values: Values;
    previous: Values | undefined;
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
        style={{
          whiteSpace: "nowrap",
          textDecorationLine: service.sign === "-" ? "line-through" : undefined,
        }}
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
          <div
            className={header}
            tabIndex={described ? 0 : undefined}
            data-service-header={service.name}
          >
            {title}
          </div>
        ) : (
          <button
            type="button"
            className={headerButton}
            aria-pressed={props.selectedAnnotation === annotation}
            aria-controls="source-diff-panel"
            aria-label={`Open source: ${service.name}`}
            data-service-header={service.name}
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
          {service.state.map(({ key, description, sign }) => {
            const changed = props.changed.has(`${service.name}.${key}`);
            // A row added or removed in a diff shows only its own side.
            const side = sign === "-" ? "today" : "proposed";
            const today = props.values.today.get(key);
            const proposed = props.values.proposed.get(key);
            return (
              <div
                key={key}
                className={stateRow}
                data-changed={changed}
                data-change={sign}
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
                  {sign === " " && today !== proposed ? (
                    <>
                      <Text
                        size="xs"
                        monospace
                        style={{ color: colors.red[11] }}
                      >
                        <s>{today}</s>{" "}
                      </Text>
                      <Text
                        size="xs"
                        monospace
                        style={{ color: colors.green[11] }}
                      >
                        {proposed}
                      </Text>
                    </>
                  ) : (
                    <>
                      {changed && (
                        <Text size="xs" monospace color="lowContrast">
                          <s>{props.previous?.[side].get(key)}</s>{" "}
                        </Text>
                      )}
                      <Text
                        size="xs"
                        monospace
                        color={changed ? "accent" : undefined}
                      >
                        {props.values[side].get(key)}
                      </Text>
                    </>
                  )}
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
 * changed row shows beside the new one, and a diff's Today value beside its
 * Proposed one.
 */
function widestState(diagram: ServiceDiagram) {
  const flat = flattenServices(diagram.services);
  const widest = new Map(
    flat.map(({ service }) => [service.name, new Map<string, string>()]),
  );
  const at = (step: number) => ({
    today: serviceStateAt(diagram, step, "today"),
    proposed: serviceStateAt(diagram, step, "proposed"),
  });
  let before = at(0);
  for (let step = 0; step <= diagram.steps.length; step++) {
    const now = step === 0 ? before : at(step);
    // A row updated in this step shows its old value struck through.
    const updated = new Set(
      diagram.steps[step - 1]?.updates.map(
        (update) => `${update.service}.${update.key}`,
      ),
    );
    for (const { service } of flat)
      for (const { key } of service.state) {
        const best = widest.get(service.name)!;
        const value = (state: State) => state.get(service.name)!.get(key);
        const today = value(now.today);
        const proposed = value(now.proposed);
        const shown = [
          today === undefined || proposed === undefined || today === proposed
            ? (proposed ?? today ?? "")
            : `${today} ${proposed}`,
        ];
        if (updated.has(`${service.name}.${key}`))
          shown.push(
            `${value(before.today) ?? ""} ${today ?? ""}`,
            `${value(before.proposed) ?? ""} ${proposed ?? ""}`,
          );
        for (const candidate of shown)
          if (candidate.length > (best.get(key)?.length ?? -1))
            best.set(key, candidate);
      }
    before = now;
  }
  return widest;
}

function valuesOf(state: SidedState, service: string): Values {
  return {
    today: state.today.get(service)!,
    proposed: state.proposed.get(service)!,
  };
}

/** The sign every event shares, or " " when they differ. */
function commonSign(events: ServiceEvent[]): Sign {
  return events.every((event) => event.sign === events[0]!.sign)
    ? events[0]!.sign
    : " ";
}

/** Link colors: idle or carrying events, and Today only, Proposed only, or both. */
const tones = (["idle", "active"] as const).flatMap((state) =>
  (["+", "-", " "] as const).map((sign) => {
    const scale =
      sign === "+" ? colors.green : sign === "-" ? colors.red : undefined;
    const active = state === "active";
    const line = active
      ? (scale?.[9] ?? colors.accent[9])
      : (scale?.[9] ?? colors.gray[9]);
    return {
      id: `${state}-${{ "+": "added", "-": "removed", " ": "same" }[sign]}`,
      state,
      sign,
      line,
      head: line,
    };
  }),
);

function toneFor(active: boolean, sign: Sign) {
  return tones.find(
    (tone) => tone.sign === sign && (tone.state === "active") === active,
  )!;
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

const described = {
  "&[data-described='true']": {
    textDecorationLine: "underline",
    textDecorationStyle: "dotted" as const,
    textDecorationColor: colors.gray[8],
    textUnderlineOffset: "3px",
  },
};

const styles = {
  stage: style(
    {
      position: "relative",
      minWidth: 0,
      overflowX: "auto",
      overflowY: "hidden",
    },
    focusRing(),
  ),
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
    "& > [data-measure-event]": {
      position: "absolute",
      width: "max-content",
      maxWidth: "var(--label-width)",
    },
  }),
  canvas: style({
    position: "absolute",
    top: 0,
  }),
  noteLines: style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
    zIndex: 3,
    "& path": { stroke: colors.accent[7], strokeWidth: 1 },
    "& circle": { fill: colors.gray[12] },
    "& text": {
      fill: backgroundColor.app,
      fontSize: 9,
      fontWeight: 600,
      textAnchor: "middle",
      dominantBaseline: "central",
    },
  }),
  // Sits on the note's top-left corner, so it doesn't push the text over.
  noteNumber: style({
    position: "absolute",
    top: 4,
    left: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 14,
    height: 14,
    borderRadius: "50%",
    fontSize: 9,
    fontWeight: 600,
    color: backgroundColor.app,
    backgroundColor: colors.gray[12],
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
    "&[data-change='+']": {
      borderColor: colors.green[8],
      backgroundColor: colors.green[2],
    },
    "&[data-change='-']": {
      borderColor: colors.red[8],
      borderStyle: "dashed",
      backgroundColor: colors.red[2],
    },
    "&[data-active='true']": { borderColor: colors.accent[8] },
    "&[data-active='true'][data-change='+']": { borderColor: colors.green[10] },
    "&[data-active='true'][data-change='-']": { borderColor: colors.red[10] },
  }),
  header: style(
    flex({ direction: "row", alignItems: "baseline", gap: 3, wrap: true }),
    spacing.padding({ x: 4, y: 3 }),
    focusRing(),
    {
      minWidth: 0,
      "& > [data-described='true']": described["&[data-described='true']"],
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
    "&[data-change='+']": {
      backgroundColor: colors.greenAlpha[3],
      boxShadow: `inset 2px 0 ${colors.green[9]}`,
    },
    "&[data-change='-']": {
      backgroundColor: colors.redAlpha[3],
      boxShadow: `inset 2px 0 ${colors.red[9]}`,
    },
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
    "&[data-change='+']": {
      backgroundColor: colors.green[9],
      boxShadow: `0 0 0 3px ${colors.greenAlpha[5]}`,
    },
    "&[data-change='-']": {
      backgroundColor: colors.red[9],
      boxShadow: `0 0 0 3px ${colors.redAlpha[5]}`,
    },
  }),
  labelAnchor: style({
    position: "absolute",
    zIndex: 1,
    transform: "translateX(-50%)",
  }),
  pill: style(
    radius.sm,
    text({ size: "xs", monospace: true }),
    spacing.padding({ x: 3 }),
    {
      display: "block",
      paddingBlock: 0,
      maxWidth: 220,
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      textAlign: "start",
      border: `1px solid ${colors.accent[7]}`,
      backgroundColor: backgroundColor.app,
      color: colors.gray[12],
      "&[data-change='+']": {
        borderColor: colors.green[7],
        color: colors.green[11],
      },
      "&[data-change='-']": {
        borderColor: colors.red[7],
        borderStyle: "dashed",
        color: colors.red[11],
      },
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
      overflowWrap: "anywhere",
      border: `1px solid ${colors.accent[7]}`,
      backgroundColor: backgroundColor.app,
      // Under the diagram: centered, and wider since there is room.
      "&[data-below='true']": {
        right: 0,
        marginInline: "auto",
        maxWidth: "min(100%, 420px)",
        paddingLeft: 24,
      },
    },
  ),
};
