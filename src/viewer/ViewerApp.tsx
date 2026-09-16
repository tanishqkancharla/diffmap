import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  backgroundColor,
  border,
  colors,
  flex,
  flexItem,
  proseHtml,
  proseMaxWidth,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { ViewerDocument } from "../parseViewer.js";
import { ComarkView } from "./ComarkView.tsx";
import { SourceDiffPanel, type SourceSelection } from "./SourceDiffPanel.js";
import { DoneButton } from "./DoneButton.tsx";
import { DiffButton } from "./DiffButton.tsx";
import { TableOfContents } from "./TableOfContents.tsx";
import { ViewerModeContext, type ViewerMode } from "./viewerMode.ts";

type ViewerMeta = {
  title: string;
};

export function ViewerApp(props: {
  document: ViewerDocument;
  mode: ViewerMode;
  title?: string;
  headerActions?: ReactNode;
}) {
  const viewerDocument = props.document;
  const meta = useViewerMeta(props.mode === "local");
  const [selection, setSelection] = useState<SourceSelection>();
  const [showDiffPanel, setShowDiffPanel] = useState(false);
  const hasSourceDiffs =
    viewerDocument.sourceDiffs.length > 0 || viewerDocument.hasReferences;
  const diffPanelOpen = hasSourceDiffs && showDiffPanel;
  const body = useStyles(styles.body);
  const [shutDown, setShutDown] = useState(false);
  const parsedTitle =
    props.title ??
    viewerDocument.headings.find((heading) => heading.level === 1)?.text ??
    "diffmap";
  const title =
    props.mode === "local" && meta !== undefined ? meta.title : parsedTitle;
  const shell = useStyles(styles.shell);
  const header = useStyles(styles.header);
  const heading = useStyles(styles.heading);
  const titleClass = useStyles(styles.title);
  const actions = useStyles(styles.actions);
  const article = useStyles(styles.article);
  const prose = useStyles(styles.prose);
  const content = useStyles(proseHtml("md"), styles.content);
  const closed = useStyles(styles.closed);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (id === "") return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  if (shutDown) {
    return <main className={closed}>Closed.</main>;
  }

  return (
    <ViewerModeContext.Provider value={props.mode}>
      <div className={shell}>
        <header className={header}>
          <div className={heading}>
            <div className={titleClass}>{title}</div>
          </div>
          <div className={actions}>
            {hasSourceDiffs && (
              <DiffButton
                pressed={showDiffPanel}
                onClick={() => setShowDiffPanel((open) => !open)}
              />
            )}
            {props.headerActions}
            {props.mode === "local" && (
              <DoneButton
                onClick={() => {
                  setShutDown(true);
                  // oxlint-disable-next-line typescript/no-floating-promises -- React click callbacks cannot await the server shutdown request.
                  void closeViewer();
                }}
              />
            )}
          </div>
        </header>
        <div className={body} data-has-source-diffs={diffPanelOpen}>
          <TableOfContents
            headings={viewerDocument.headings}
            articleRef={articleRef}
          />
          <article ref={articleRef} className={article}>
            <div className={prose}>
              <div className={content} data-diffmap-kind="page">
                <ComarkView
                  document={viewerDocument}
                  selectedAnnotation={selection?.annotation}
                  onSelectAnnotation={(line) => {
                    setShowDiffPanel(true);
                    setSelection({
                      annotation: line,
                      reference: line.references[0]!,
                    });
                  }}
                />
              </div>
            </div>
          </article>
          {diffPanelOpen && (
            <SourceDiffPanel
              items={viewerDocument.sourceDiffs}
              selection={selection}
              onSelect={setSelection}
            />
          )}
        </div>
      </div>
    </ViewerModeContext.Provider>
  );
}

function useViewerMeta(enabled: boolean) {
  const [meta, setMeta] = useState<ViewerMeta>();
  useEffect(() => {
    if (!enabled) return;
    // oxlint-disable-next-line typescript/no-floating-promises -- React effects cannot await; this request owns the metadata update.
    void fetch("/__diffmap/meta")
      .then((response) => response.json())
      .then((value) => {
        // SAFETY: the diffmap CLI serves this shape from extractTitle.
        setMeta(value as ViewerMeta);
      });
  }, [enabled]);
  return meta;
}

async function closeViewer() {
  await fetch("/__diffmap/shutdown", { method: "POST" });
}

const styles = {
  shell: style(flex({ direction: "column" }), {
    width: "100%",
    height: "100vh",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: colors.gray[4],
  }),
  header: style(
    flex({ direction: "row", align: "center", justify: "between" }),
    spacing.padding({ x: 6, y: 3 }),
    flexItem({ size: "hug" }),
    border(["bottom"], "border"),
    {
      minWidth: 0,
      backgroundColor: backgroundColor.app,
    },
  ),
  heading: style(flex({ direction: "column" }), {
    minWidth: 0,
  }),
  title: style(text({ size: "md", fontWeight: 600, color: "highContrast" }), {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  actions: style(flex({ direction: "row", align: "center", gap: 3 }), {
    flexShrink: 0,
  }),
  body: style({
    display: "grid",
    gridTemplateColumns: "var(--diffmap-columns)",
    gridTemplateRows: "minmax(0, 1fr)",
    "--diffmap-columns": "minmax(0, max-content) minmax(0, 1fr)",
    flex: "1 1 auto",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    "&[data-has-source-diffs='true']": {
      "--diffmap-columns":
        "minmax(0, max-content) minmax(0, 1fr) minmax(0, 1fr)",
    },
    "@media (max-width: 900px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gridTemplateRows: "minmax(0, 1fr) auto",
    },
  }),
  article: style(spacing.padding({ x: 12, y: 12 }), {
    gridColumn: "2",
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    backgroundColor: backgroundColor.app,
    "@media (max-width: 900px)": {
      gridColumn: "1",
    },
  }),
  prose: style({
    display: "grid",
    gridTemplateColumns: `minmax(0, 1fr) minmax(0, ${proseMaxWidth}) minmax(0, 1fr)`,
    width: "100%",
    maxWidth: "none",
    minWidth: 0,
  }),
  content: style({
    gridColumn: "2 / 3",
    width: "100%",
    maxWidth: "none",
    minWidth: 0,
    "& h1, & h2, & h3, & h4, & h5, & h6": {
      scrollMarginTop: spacing.value(4),
    },
    "& ul > li[data-task]::before, & ol > li[data-task]::before": {
      content: "none",
    },
    "& ul > li[data-task] > .diffmap-task-checkbox, & ol > li[data-task] > .diffmap-task-checkbox":
      {
        // Maui proseHtml md listPadding.
        position: "absolute",
        left: "-20px",
        top: "6px",
      },
    "& .diffmap-task-checkbox label > span:last-child": {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: 0,
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: 0,
    },
  }),
  closed: style(
    text({ size: "md", fontWeight: 500, color: "highContrast" }),
    spacing.padding({ all: 12 }),
    {
      minHeight: "100vh",
      backgroundColor: backgroundColor.app,
    },
  ),
};
