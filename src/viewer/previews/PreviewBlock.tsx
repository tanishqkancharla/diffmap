import { useState, type ReactNode } from "react";
import { Checkbox, colors, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import type { PreviewStoryInfo } from "../../preview/protocol.js";
import { fenceTitle, pierreShell } from "../pierre.js";
import { useViewerMode } from "../viewerMode.ts";
import { storyLabel, useDiffmapConfig } from "./config.ts";
import { PreviewFrame } from "./PreviewFrame.tsx";
import { useReviewedStates } from "./reviewedStates.ts";

/** A `preview` fence: each story it lists, live from the app's preview page, side by side when they fit. */
export function PreviewBlock(props: {
  stories: string[];
  title: string | undefined;
}) {
  const page = usePreviewPage();
  const [catalog, setCatalog] = useState<Map<string, PreviewStoryInfo>>();
  const [fingerprints, setFingerprints] = useState<Record<string, string>>({});
  const { isReviewed, setReviewed } = useReviewedStates();
  const card = useStyles(pierreShell);
  const caption = useStyles(fenceTitle);
  const grid = useStyles(
    styles.grid,
    props.stories.length > 1 && styles.multiple,
  );
  const cell = useStyles(styles.cell);
  const name = useStyles(styles.name);
  const note = useStyles(styles.note);
  return (
    <figure className={card} data-diffmap-kind="preview">
      {props.title !== undefined && (
        <figcaption className={caption}>{props.title}</figcaption>
      )}
      {"message" in page ? (
        page.message
      ) : (
        <div className={grid}>
          {props.stories.map((id) => {
            const info = catalog?.get(id);
            const fingerprint = fingerprints[id];
            const key = `preview:${id}`;
            return (
              <div key={id} className={cell}>
                <PreviewFrame
                  page={page.url}
                  initialPath={[id]}
                  mode="live"
                  maxHeight={560}
                  label={info === undefined ? id : storyLabel(info.name)}
                  onReady={(stories) =>
                    setCatalog(
                      new Map(stories.map((story) => [story.id, story])),
                    )
                  }
                  onState={(state) =>
                    setFingerprints((current) => ({
                      ...current,
                      [id]: state.fingerprint,
                    }))
                  }
                />
                <div className={name}>
                  <span>{info === undefined ? id : storyLabel(info.name)}</span>
                  <Checkbox
                    label="Reviewed"
                    checked={isReviewed(key, fingerprint)}
                    setChecked={(value) => {
                      if (fingerprint !== undefined)
                        setReviewed(key, fingerprint, value);
                    }}
                  />
                </div>
                {info?.description !== undefined && (
                  <div className={note}>{info.description}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </figure>
  );
}

/** The preview page's URL, or why a block can't show live UI here. */
export function usePreviewPage(): { url: string } | { message: ReactNode } {
  const local = useViewerMode() === "local";
  const config = useDiffmapConfig();
  if (!local)
    return {
      message: (
        <Notice>
          Live previews show when you run this spec with diffmap serve.
        </Notice>
      ),
    };
  if (config === undefined) return { message: <Notice>Loading…</Notice> };
  if ("error" in config)
    return {
      message: <Notice>Can't read .diffmap/config.json: {config.error}</Notice>,
    };
  const url = config.config.previews?.local;
  if (url === undefined)
    return {
      message: (
        <Notice>
          Add previews.local to .diffmap/config.json, the URL of the app's
          preview page, such as http://localhost:5173/previews.html.
        </Notice>
      ),
    };
  return { url };
}

function Notice(props: { children: ReactNode }) {
  const className = useStyles(styles.notice);
  return <div className={className}>{props.children}</div>;
}

const styles = {
  grid: style({
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: spacing.value(1),
    backgroundColor: colors.gray[4],
  }),
  multiple: style({
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  }),
  cell: style({
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    backgroundColor: colors.gray[1],
  }),
  name: style(
    text({ size: "xs", fontWeight: 500 }),
    spacing.padding({ x: 6, y: 3 }),
    {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.value(4),
      borderTop: `1px solid ${colors.gray[4]}`,
    },
  ),
  note: style(
    text({ size: "xs", color: "lowContrast" }),
    spacing.padding({ x: 6, bottom: 3 }),
    { margin: 0 },
  ),
  notice: style(
    text({ size: "sm", color: "lowContrast" }),
    spacing.padding({ all: 6 }),
  ),
};
