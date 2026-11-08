import type { ReactNode } from "react";
import { colors, flex, text } from "maui";
import { style, useStyles } from "purse-styles";
import {
  CodeDrawer,
  DiffHeadline,
  Footer,
  Nav,
  SpecFence,
  styles as shared,
  type SpecViews,
} from "./shared.tsx";

/**
 * Direction C: closest to today's page. It still reads like a spec, top to
 * bottom, but each stage of the workflow gets a sticky title on the left and
 * its diagrams full size on the right.
 */
export function TimelineVariant(props: { views: SpecViews }) {
  const page = useStyles(shared.page);
  const container = useStyles(shared.container);
  const hero = useStyles(styles.hero);
  const lede = useStyles(shared.lede, styles.ledeWidth);
  const chips = useStyles(styles.chips);
  const chip = useStyles(styles.chip);
  const timeline = useStyles(styles.timeline);
  const views = props.views;

  return (
    <div className={page} id="top">
      <Nav />
      <header className={`${container} ${hero}`}>
        <DiffHeadline
          align="start"
          before="Review the"
          removed="line diff"
          added="design."
        />
        <p className={lede}>
          Your coding agent writes more code than you can review. diffmap is a
          living spec it writes before it codes: you review the plan as
          diagrams, then each phase as it lands.
        </p>
        <ul className={chips} aria-label="On this page">
          {stages.map((stage) => (
            <li key={stage.id}>
              <a className={chip} href={`#${stage.id}`}>
                <span>{stage.number}</span>
                {stage.short}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <div className={`${container} ${timeline}`}>
        <Stage {...stages[0]}>
          <Figure label="Plan new work">
            <SpecFence fence={views.planPrompt} />
          </Figure>
          <Figure label="Or explain a branch that is already written">
            <SpecFence fence={views.branchPrompt} />
          </Figure>
        </Stage>
        <Stage {...stages[1]}>
          <Figure label="Service diagram · press Play">
            <SpecFence fence={views.services} />
          </Figure>
          <Figure label="Diagram diff · click a box to open its code">
            <SpecFence fence={views.mermaid} />
          </Figure>
          <Figure label="Call stack">
            <SpecFence fence={views.callstack} />
          </Figure>
        </Stage>
        <Stage {...stages[2]}>
          <Figure label="Phase 1 · committed as 5e5510a">
            <SpecFence fence={views.changes} />
          </Figure>
          <Figure label="Every link now points at that commit">
            <SpecFence fence={views.loginStack} />
          </Figure>
        </Stage>
        <Stage {...stages[3]}>
          <Figure label="Install the skill">
            <SpecFence fence={views.install} />
          </Figure>
          <Figure label="Share a spec as a diffmap.dev link">
            <SpecFence fence={views.share} />
          </Figure>
        </Stage>
      </div>
      <Footer />
      <CodeDrawer />
    </div>
  );
}

const stages = [
  {
    id: "ask",
    number: "01",
    short: "Ask",
    title: "Ask your agent for a spec",
    body: "One prompt, no setup. Try it before you install anything.",
  },
  {
    id: "plan",
    number: "02",
    short: "Review the plan",
    title: "Review the plan before any code exists",
    body: "Your agent picks the right diagram for each idea and links every part of it to the code it will touch. Comment on anything, then copy your comments back.",
  },
  {
    id: "phases",
    number: "03",
    short: "Review each phase",
    title: "Review each phase as it lands",
    body: "The agent builds one phase at a time, one commit each. A finished phase lists the files to read first.",
  },
  {
    id: "keep",
    number: "04",
    short: "Keep it",
    title: "Keep it, and share it",
    body: "diffmap is open source and MIT licensed. Specs run on your machine, or open on diffmap.dev from a pull request or a gist.",
  },
] as const;

function Stage(props: {
  id: string;
  number: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  const row = useStyles(styles.stage);
  const aside = useStyles(styles.aside);
  const number = useStyles(styles.number);
  const h2 = useStyles(shared.h2, styles.stageTitle);
  const body = useStyles(shared.body);
  const figures = useStyles(styles.figures);
  return (
    <section className={row} id={props.id}>
      <div className={aside}>
        <span className={number}>{props.number}</span>
        <h2 className={h2}>{props.title}</h2>
        <p className={body}>{props.body}</p>
      </div>
      <div className={figures}>{props.children}</div>
    </section>
  );
}

function Figure(props: { label: string; children: ReactNode }) {
  const figure = useStyles(styles.figure);
  const label = useStyles(shared.label);
  return (
    <figure className={figure}>
      <figcaption className={label}>{props.label}</figcaption>
      {props.children}
    </figure>
  );
}

const styles = {
  hero: style(flex({ direction: "column", gap: 8 }), {
    paddingTop: "88px",
    paddingBottom: "40px",
  }),
  ledeWidth: style({ maxWidth: "600px" }),
  chips: style(flex({ direction: "row", gap: 3 }), {
    listStyle: "none",
    margin: "12px 0 0",
    padding: 0,
    flexWrap: "wrap",
  }),
  chip: style(
    flex({ direction: "row", alignItems: "center", gap: 3 }),
    text({ size: "sm", color: "highContrast" }),
    {
      textDecoration: "none",
      padding: "5px 12px 5px 6px",
      borderRadius: "999px",
      backgroundColor: colors.grayAlpha[3],
      "&:hover": { backgroundColor: colors.grayAlpha[4] },
      "& > span": {
        fontFamily: "var(--maui-mono-font, ui-monospace, monospace)",
        fontSize: "11px",
        padding: "1px 6px",
        borderRadius: "999px",
        color: colors.accent[11],
        backgroundColor: colors.gray[1],
      },
    },
  ),
  timeline: style(flex({ direction: "column" })),
  stage: style({
    display: "grid",
    gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)",
    gap: "64px",
    paddingBlock: "72px",
    borderTop: `1px solid ${colors.grayAlpha[4]}`,
    scrollMarginTop: "52px",
    "@media (max-width: 900px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "24px",
      paddingBlock: "48px",
    },
  }),
  aside: style(flex({ direction: "column", gap: 6 }), {
    position: "sticky",
    top: "88px",
    alignSelf: "start",
    "@media (max-width: 900px)": { position: "static" },
  }),
  number: style({
    fontSize: "56px",
    lineHeight: 1,
    fontWeight: 600,
    letterSpacing: "-0.04em",
    color: colors.gray[6],
    fontVariantNumeric: "tabular-nums",
  }),
  stageTitle: style({ fontSize: "clamp(24px, 2.6vw, 30px)" }),
  figures: style(flex({ direction: "column", gap: 16 }), { minWidth: 0 }),
  figure: style(flex({ direction: "column", gap: 4 }), { margin: 0 }),
};
