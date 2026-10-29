import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  Button,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateAntiClockwise,
  Text,
  Tooltip,
  colors,
  flex,
  focusRing,
  radius,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { SourceNavigation } from "../annotations.js";
import { fenceTitle, pierreShell } from "./pierre.js";
import { ServiceStage, TRAVEL_MS } from "./ServiceStage.tsx";
import {
  serviceStateAt,
  type ServiceDiagram,
  type ServicesParse,
} from "../services.js";

const DWELL_MS = 1200;

/** Names a diff step's side before its caption. */
const signLabel = { "+": "Added: ", "-": "Removed: ", " ": "" } as const;

type Phase = "travel" | "settled";

export function ServiceDiagramBlock(
  props: {
    source: string;
    parsed: ServicesParse;
  } & SourceNavigation,
) {
  const error = useStyles(styles.error);
  if (!props.parsed.ok)
    return (
      <div className={error} data-diffmap-kind="services">
        Line {props.parsed.line}: {props.parsed.reason}
      </div>
    );
  // Remount on edits so playback restarts and the stage measures new boxes.
  return (
    <ServicePlayer
      key={props.source}
      {...props}
      diagram={props.parsed.diagram}
    />
  );
}

function ServicePlayer(props: { diagram: ServiceDiagram } & SourceNavigation) {
  const diagram = props.diagram;
  const last = diagram.steps.length;
  const reduceMotion = Boolean(useReducedMotion());
  const [position, setPosition] = useState<{ step: number; phase: Phase }>({
    step: 0,
    phase: "settled",
  });
  const [playing, setPlaying] = useState(false);
  const states = useMemo(
    () =>
      Array.from({ length: last + 1 }, (_, step) => ({
        today: serviceStateAt(diagram, step, "today"),
        proposed: serviceStateAt(diagram, step, "proposed"),
      })),
    [diagram, last],
  );
  const step = position.step;
  const current = step === 0 ? undefined : diagram.steps[step - 1]!;
  // Before step 1, the author's start caption, if any, explains the state.
  const captioned = current ?? diagram.start;
  const settled = position.phase === "settled";
  // In flight, the events have not landed, so show the previous state.
  const shownState = states[settled ? step : step - 1]!;
  const changed = new Set(
    settled && current !== undefined
      ? current.updates.map((update) => `${update.service}.${update.key}`)
      : [],
  );
  const active = new Set(
    current?.events.flatMap((event) => [event.from, event.to]) ?? [],
  );

  const goTo = (target: number, animate: boolean) =>
    setPosition(positionFor(diagram, target, animate && !reduceMotion));

  useEffect(() => {
    if (position.phase !== "travel") return;
    const timer = setTimeout(
      () => setPosition({ step: position.step, phase: "settled" }),
      TRAVEL_MS,
    );
    return () => clearTimeout(timer);
  }, [position]);

  useEffect(() => {
    if (!playing || position.phase !== "settled") return;
    const timer = setTimeout(
      () => {
        if (position.step >= last) setPlaying(false);
        else
          setPosition(positionFor(diagram, position.step + 1, !reduceMotion));
      },
      position.step === 0 ? 300 : DWELL_MS,
    );
    return () => clearTimeout(timer);
  }, [playing, position, last, diagram, reduceMotion]);

  const prev = () => {
    setPlaying(false);
    if (step > 0) goTo(step - 1, false);
  };
  const next = () => {
    setPlaying(false);
    if (step < last) goTo(step + 1, true);
  };
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (step >= last) goTo(0, false);
    setPlaying(true);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    }
  };

  const frame = useStyles(pierreShell, styles.frame);
  const body = useStyles(styles.body);
  const controls = useStyles(styles.controls);
  const scrubber = useStyles(styles.scrubber);
  const segment = useStyles(styles.segment);
  const detail = useStyles(fenceTitle, styles.detail);
  const counter = useStyles(styles.counter);

  return (
    <figure
      className={frame}
      data-diffmap-kind="services"
      // Capture: Maui's Button stops arrow keys from bubbling.
      onKeyDownCapture={onKeyDown}
    >
      {/* The caption leads: before step 1 it is the start caption, which
          captions the whole diagram. */}
      {(captioned !== undefined || last > 0) && (
        <figcaption className={detail} aria-live="polite">
          {captioned !== undefined && (
            <Text size="sm" fontWeight={500}>
              {current !== undefined && current.sign !== " " && (
                <Text
                  size="sm"
                  fontWeight={600}
                  style={{
                    color:
                      current.sign === "+" ? colors.green[11] : colors.red[11],
                  }}
                >
                  {signLabel[current.sign]}
                </Text>
              )}
              {captioned.caption}
            </Text>
          )}
          {captioned?.description !== undefined && (
            <Text size="xs" color="lowContrast">
              {captioned.description}
            </Text>
          )}
        </figcaption>
      )}
      <div className={body}>
        {last > 0 && (
          <div className={controls}>
            <Tooltip content="Restart" placement="top">
              <Button
                size="sm"
                variant="quiet"
                aria-label="Restart"
                isDisabled={step === 0 && !playing}
                onClick={() => {
                  setPlaying(false);
                  goTo(0, false);
                }}
              >
                <RotateAntiClockwise size="xs" />
              </Button>
            </Tooltip>
            <Tooltip content="Previous step (←)" placement="top">
              <Button
                size="sm"
                variant="quiet"
                aria-label="Previous step"
                isDisabled={step === 0}
                onClick={prev}
              >
                <ChevronLeft size="xs" />
              </Button>
            </Tooltip>
            <Button
              size="sm"
              aria-label={playing ? "Pause" : "Play"}
              onClick={togglePlay}
            >
              {playing ? <Pause size="xs" /> : <Play size="xs" />}
              {playing ? "Pause" : step >= last ? "Replay" : "Play"}
            </Button>
            <Tooltip content="Next step (→)" placement="top">
              <Button
                size="sm"
                variant="quiet"
                aria-label="Next step"
                isDisabled={step >= last}
                onClick={next}
              >
                <ChevronRight size="xs" />
              </Button>
            </Tooltip>
            <div className={scrubber} role="group" aria-label="Steps">
              {diagram.steps.map((entry, index) => (
                <Tooltip
                  key={index}
                  placement="top"
                  content={
                    <>
                      <strong>
                        {index + 1}. {entry.caption}
                      </strong>
                      {entry.description !== undefined && (
                        <> {entry.description}</>
                      )}
                    </>
                  }
                >
                  <button
                    type="button"
                    className={segment}
                    data-change={entry.sign}
                    data-state={
                      index + 1 === step
                        ? "current"
                        : index + 1 < step
                          ? "done"
                          : "todo"
                    }
                    aria-label={`Step ${index + 1}: ${signLabel[entry.sign]}${entry.caption}`}
                    aria-current={index + 1 === step ? "step" : undefined}
                    onClick={() => {
                      setPlaying(false);
                      goTo(index + 1, index + 1 === step + 1);
                    }}
                  />
                </Tooltip>
              ))}
            </div>
            <Text className={counter} size="xs" color="lowContrast" tabular>
              {step} / {last}
            </Text>
          </div>
        )}
        <ServiceStage
          {...props}
          state={shownState}
          previousState={states[Math.max(step - 1, 0)]!}
          changed={changed}
          active={active}
          events={current?.events ?? []}
          updates={current?.updates ?? []}
          phase={position.phase}
          stepKey={step}
        />
      </div>
    </figure>
  );
}

function positionFor(
  diagram: ServiceDiagram,
  step: number,
  animate: boolean,
): { step: number; phase: Phase } {
  const events = diagram.steps[step - 1]?.events.length ?? 0;
  return { step, phase: animate && events > 0 ? "travel" : "settled" };
}

const styles = {
  error: style(text({ size: "sm", color: "lowContrast" })),
  // A card like a code block: the caption row, then the controls and stage.
  frame: style({ width: "100%", margin: 0 }),
  body: style(
    flex({ direction: "column", gap: 4 }),
    spacing.padding({ all: 6 }),
  ),
  controls: style(flex({ direction: "row", alignItems: "center", gap: 2 }), {
    // Buttons keep their full label; only the step scrubber gives up width.
    "& > button": { flexShrink: 0, overflow: "visible" },
  }),
  scrubber: style(flex({ direction: "row", alignItems: "center", gap: 1 }), {
    flex: "1 1 auto",
    minWidth: 0,
    marginInline: spacing.value(4),
  }),
  segment: style(
    radius.pill,
    {
      flex: "1 1 0",
      minWidth: 6,
      height: 20,
      padding: 0,
      border: 0,
      cursor: "pointer",
      background: "transparent",
      position: "relative",
      "&::after": {
        content: "''",
        position: "absolute",
        insetInline: 0,
        top: 8,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.gray[5],
      },
      "&:hover::after": { backgroundColor: colors.gray[7] },
      "&[data-state='done']::after": { backgroundColor: colors.accent[7] },
      "&[data-state='current']::after": { backgroundColor: colors.accent[9] },
      "&[data-change='+']::after": { backgroundColor: colors.green[6] },
      "&[data-change='+'][data-state='done']::after": {
        backgroundColor: colors.green[8],
      },
      "&[data-change='+'][data-state='current']::after": {
        backgroundColor: colors.green[10],
      },
      "&[data-change='-']::after": { backgroundColor: colors.red[6] },
      "&[data-change='-'][data-state='done']::after": {
        backgroundColor: colors.red[8],
      },
      "&[data-change='-'][data-state='current']::after": {
        backgroundColor: colors.red[10],
      },
    },
    focusRing(),
  ),
  counter: style({ flexShrink: 0, minWidth: "5ch", textAlign: "end" }),
  // Holds two lines so the controls below don't move between steps.
  detail: style(flex({ direction: "column", gap: 2 }), { minHeight: 44 }),
};
