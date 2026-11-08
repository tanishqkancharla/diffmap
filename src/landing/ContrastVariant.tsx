import type { ReactNode } from "react";
import { colors, flex, shadow, text } from "maui";
import { style, useStyles } from "purse-styles";
import commentsDemo from "../../media/comments.webp?url";
import {
  CodeDrawer,
  CodePanel,
  Eyebrow,
  Footer,
  Nav,
  SpecFence,
  TEXT_WIDTH,
  styles as shared,
  type SpecViews,
} from "./shared.tsx";

/**
 * Direction B: lead with the contrast. The same pull request as the line
 * diff you get today and as the diagram diffmap draws, then one row per view.
 */
export function ContrastVariant(props: { views: SpecViews }) {
  const page = useStyles(shared.page);
  const container = useStyles(shared.container);
  const hero = useStyles(styles.hero);
  const headline = useStyles(shared.headline, styles.headline);
  const lede = useStyles(shared.lede, styles.ledeWidth);
  const compare = useStyles(styles.compare);
  const pane = useStyles(styles.pane);
  const paneHead = useStyles(styles.paneHead);
  const paneTitle = useStyles(styles.paneTitle);
  const paneMeta = useStyles(styles.paneMeta);
  const wall = useStyles(styles.wall);
  const fade = useStyles(styles.fade);
  const picture = useStyles(styles.picture);
  const legend = useStyles(styles.legend);
  const removedKey = useStyles(styles.removedKey);
  const addedKey = useStyles(styles.addedKey);
  const h2 = useStyles(shared.h2);
  const body = useStyles(shared.body);
  const band = useStyles(styles.band);
  const bandInner = useStyles(styles.bandInner);
  const media = useStyles(styles.media);
  const muted = useStyles(styles.muted);

  return (
    <div className={page} id="top">
      <Nav />
      <header className={`${container} ${hero}`}>
        <Eyebrow>diffmap — an agent skill for code review</Eyebrow>
        <h1 className={headline}>
          Your agent changed 81 lines in 6 files.
          <br />
          <span className={muted}>Here is the change in one picture.</span>
        </h1>
        <p className={lede}>
          You should spend review time on design decisions and risky changes,
          not boilerplate. diffmap has your agent draw the change, and every
          part of the drawing opens the code behind it.
        </p>
      </header>

      <section className={`${container} ${compare}`} aria-label="Comparison">
        <div className={pane}>
          <div className={paneHead}>
            <span className={paneTitle}>The line diff</span>
            <span className={paneMeta}>6 files · +48 −33</span>
          </div>
          <div className={wall}>
            <CodePanel linked={false} />
            <div className={fade} aria-hidden />
          </div>
        </div>
        <div className={pane}>
          <div className={paneHead}>
            <span className={paneTitle}>The diffmap</span>
            <span className={paneMeta}>click any box or arrow</span>
          </div>
          <div className={picture}>
            <SpecFence fence={props.views.mermaid} />
            <div className={legend}>
              <span className={removedKey}>only today</span>
              <span className={addedKey}>new in this change</span>
            </div>
          </div>
        </div>
      </section>

      <Feature
        eyebrow="Service diagrams"
        title="Watch state move, one step at a time"
        body="Each step shows one event and the state it changes, so you never hold the system in your head. Press Play."
      >
        <SpecFence fence={props.views.services} />
      </Feature>
      <Feature
        flip
        eyebrow="Call stacks"
        title="Follow the data, call by call"
        body="New rows are green, removed rows are red, and each row opens the line that runs it."
      >
        <SpecFence fence={props.views.callstack} />
      </Feature>
      <Feature
        eyebrow="Phases and commits"
        title="Review each phase as it lands"
        body="Your agent builds the plan one phase at a time. Each finished phase is a commit card that lists the files worth reading first."
      >
        <SpecFence fence={props.views.changes} />
      </Feature>
      <Feature
        flip
        eyebrow="Comments"
        title="Comment like a pull request, paste it to your agent"
        body="Highlight text or drag across lines to leave a note. Copy comments turns them into one Markdown list your agent can act on."
      >
        <img
          className={media}
          src={commentsDemo}
          alt="Leaving comments on a spec and its diff, then copying them for the agent"
        />
      </Feature>

      <section className={band} id="install">
        <div className={`${container} ${bandInner}`}>
          <h2 className={h2}>Try it on the branch you have open</h2>
          <p className={body}>
            Paste this into your agent. If you like the result, install the
            skill.
          </p>
          <SpecFence fence={props.views.branchPrompt} />
          <SpecFence fence={props.views.install} />
        </div>
      </section>
      <Footer />
      <CodeDrawer />
    </div>
  );
}

function Feature(props: {
  eyebrow: string;
  title: string;
  body: string;
  flip?: boolean;
  children: ReactNode;
}) {
  const container = useStyles(shared.container);
  const row = useStyles(styles.feature);
  const copy = useStyles(styles.featureCopy);
  const visual = useStyles(styles.featureVisual);
  const h2 = useStyles(shared.h2);
  const body = useStyles(shared.body);
  return (
    <section
      className={`${container} ${row}`}
      data-flip={props.flip ? "true" : undefined}
    >
      <div className={copy}>
        <Eyebrow>{props.eyebrow}</Eyebrow>
        <h2 className={h2}>{props.title}</h2>
        <p className={body}>{props.body}</p>
      </div>
      <div className={visual}>{props.children}</div>
    </section>
  );
}

const WALL_HEIGHT = "520px";

const styles = {
  hero: style(flex({ direction: "column", gap: 8 }), {
    paddingTop: "64px",
    paddingBottom: "40px",
  }),
  headline: style({ fontSize: "clamp(30px, 3.8vw, 46px)", maxWidth: "1000px" }),
  muted: style({ color: colors.gray[10] }),
  ledeWidth: style({ maxWidth: "640px" }),
  compare: style({
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.5fr)",
    gap: "20px",
    "@media (max-width: 900px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  }),
  pane: style(flex({ direction: "column", gap: 4 }), { minWidth: 0 }),
  paneHead: style(
    flex({
      direction: "row",
      alignItems: "baseline",
      justifyContent: "between",
    }),
    { paddingInline: "2px" },
  ),
  paneTitle: style(
    text({ size: "sm", fontWeight: 600, color: "highContrast" }),
  ),
  paneMeta: style(text({ size: "xs", monospace: true, color: "lowContrast" })),
  wall: style(shadow.subtle, {
    position: "relative",
    height: WALL_HEIGHT,
    borderRadius: "8px",
    overflow: "hidden",
    // Read as "too much": the wall stays legible but recedes behind the picture.
    filter: "saturate(0.6)",
    opacity: 0.85,
  }),
  fade: style({
    position: "absolute",
    insetInline: 0,
    bottom: 0,
    height: "160px",
    pointerEvents: "none",
    background: `linear-gradient(to bottom, transparent, ${colors.gray[1]})`,
  }),
  picture: style(flex({ direction: "column", gap: 4 }), {
    minHeight: WALL_HEIGHT,
    justifyContent: "center",
    padding: "12px",
    borderRadius: "8px",
    backgroundColor: colors.gray[2],
    boxSizing: "border-box",
  }),
  legend: style(
    flex({ direction: "row", gap: 8, justifyContent: "center" }),
    text({ size: "xs", color: "lowContrast" }),
  ),
  removedKey: style({
    "&::before": {
      content: '""',
      display: "inline-block",
      width: "16px",
      height: 0,
      marginRight: "6px",
      verticalAlign: "middle",
      borderTop: `2px dashed ${colors.red[9]}`,
    },
  }),
  addedKey: style({
    "&::before": {
      content: '""',
      display: "inline-block",
      width: "16px",
      height: 0,
      marginRight: "6px",
      verticalAlign: "middle",
      borderTop: `2px solid ${colors.green[9]}`,
    },
  }),
  feature: style({
    display: "grid",
    "--feature-columns": "minmax(0, 5fr) minmax(0, 7fr)",
    "--feature-areas": '"copy visual"',
    gridTemplateColumns: "var(--feature-columns)",
    gridTemplateAreas: "var(--feature-areas)",
    alignItems: "center",
    gap: "56px",
    paddingTop: "128px",
    "&[data-flip='true']": {
      "--feature-columns": "minmax(0, 7fr) minmax(0, 5fr)",
      "--feature-areas": '"visual copy"',
    },
    "@media (max-width: 900px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gridTemplateAreas: '"copy" "visual"',
      gap: "24px",
      paddingTop: "80px",
    },
  }),
  featureCopy: style(flex({ direction: "column", gap: 6 }), {
    gridArea: "copy",
    maxWidth: "440px",
  }),
  featureVisual: style({ gridArea: "visual", minWidth: 0 }),
  media: style(shadow.subtle, {
    display: "block",
    width: "100%",
    borderRadius: "8px",
  }),
  band: style({
    marginTop: "140px",
    paddingBlock: "72px",
    backgroundColor: colors.gray[2],
    borderBlock: `1px solid ${colors.grayAlpha[4]}`,
  }),
  bandInner: style(flex({ direction: "column", gap: 6 }), {
    "& > *": { maxWidth: TEXT_WIDTH, width: "100%" },
  }),
};
