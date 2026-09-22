import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  backgroundColor,
  border,
  colors,
  flex,
  flexItem,
  H1,
  P,
  proseHtml,
  proseMaxWidth,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { ViewerDocument } from "../parseViewer.js";
import { ComarkView } from "./ComarkView.tsx";
import { SourceDiffPanel, type SourceSelection } from "./SourceDiffPanel.js";
import { CloseServerButton } from "./CloseServerButton.tsx";
import { DiffButton } from "./DiffButton.tsx";
import { TocButton } from "./TocButton.tsx";
import {
  hasTableOfContents,
  TableOfContents,
  TOC_SIDE_MARGIN_PX,
} from "./TableOfContents.tsx";
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
  const closedCopy = useStyles(styles.closedCopy);
  const stage = useStyles(styles.stage);
  const articleRef = useRef<HTMLElement>(null);
  const hasToc = hasTableOfContents(viewerDocument.headings);
  const [tocOpen, setTocOpen] = useState<"click" | "dwell">();
  const tocExpanded = tocOpen !== undefined;
  const onDwellOpen = useCallback(() => {
    setTocOpen((mode) => (mode === "click" ? mode : "dwell"));
  }, []);
  const onDwellClose = useCallback(() => {
    setTocOpen((mode) => (mode === "click" ? mode : undefined));
  }, []);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (id === "") return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  if (shutDown) {
    return (
      <main className={closed}>
        <div className={closedCopy}>
          <H1>Closed spec</H1>
          <P>The local server stopped.</P>
        </div>
      </main>
    );
  }

  return (
    <ViewerModeContext.Provider value={props.mode}>
      <div className={shell}>
        <header className={header}>
          <div className={heading}>
            {hasToc && (
              <TocButton
                expanded={tocExpanded}
                onClick={() => {
                  setTocOpen((mode) =>
                    mode === undefined ? "click" : undefined,
                  );
                }}
              />
            )}
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
              <CloseServerButton
                onClick={() => {
                  setShutDown(true);
                  // oxlint-disable-next-line typescript/no-floating-promises -- React click callbacks cannot await the server shutdown request.
                  void closeViewer();
                }}
              />
            )}
          </div>
        </header>
        <div className={stage}>
          <div className={body} data-has-source-diffs={diffPanelOpen}>
            <article ref={articleRef} className={article}>
              <div className={prose} data-has-toc={hasToc ? "true" : "false"}>
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
                {hasToc && (
                  <TableOfContents
                    headings={viewerDocument.headings}
                    articleRef={articleRef}
                    open={tocExpanded}
                    onDwellOpen={onDwellOpen}
                    onDwellClose={onDwellClose}
                  />
                )}
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
    flex({ direction: "row", alignItems: "center", justifyContent: "between" }),
    spacing.padding({ x: 6, y: 3 }),
    flexItem({ size: "hug" }),
    border(["bottom"], "border"),
    {
      minWidth: 0,
      backgroundColor: backgroundColor.app,
    },
  ),
  heading: style(flex({ direction: "row", alignItems: "center", gap: 3 }), {
    minWidth: 0,
    flex: "1 1 auto",
  }),
  title: style(text({ size: "md", fontWeight: 600, color: "highContrast" }), {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  actions: style(flex({ direction: "row", alignItems: "center", gap: 3 }), {
    flexShrink: 0,
  }),
  stage: style(flex({ direction: "column" }), {
    position: "relative",
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
  }),
  body: style({
    display: "grid",
    gridTemplateRows: "minmax(0, 1fr)",
    flex: "1 1 auto",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
    "--diffmap-columns": "minmax(0, 1fr)",
    "--diffmap-areas": '"article"',
    gridTemplateColumns: "var(--diffmap-columns)",
    gridTemplateAreas: "var(--diffmap-areas)",
    "&[data-has-source-diffs='true']": {
      "--diffmap-columns": "minmax(0, 1fr) minmax(0, 1fr)",
      "--diffmap-areas": '"article diff"',
    },
    "@media (max-width: 900px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gridTemplateRows: "minmax(0, 1fr) auto",
      gridTemplateAreas: '"article" "diff"',
    },
  }),
  article: style(spacing.padding({ x: 12, y: 12 }), {
    gridArea: "article",
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    backgroundColor: backgroundColor.app,
    // Scrollport size for the sticky gutter rail (`100cqh`).
    containerType: "size",
  }),
  prose: style({
    display: "grid",
    gridTemplateColumns: `minmax(0, 1fr) minmax(0, ${proseMaxWidth}) minmax(0, 1fr)`,
    width: "100%",
    maxWidth: "none",
    minWidth: 0,
    "&[data-has-toc='true']": {
      gridTemplateColumns: `minmax(${String(TOC_SIDE_MARGIN_PX)}px, 1fr) minmax(0, ${proseMaxWidth}) minmax(${String(TOC_SIDE_MARGIN_PX)}px, 1fr)`,
    },
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
    flex({
      direction: "column",
      alignItems: "center",
      justifyContent: "center",
    }),
    spacing.padding({ x: 12, y: 12 }),
    {
      minHeight: "100vh",
      backgroundColor: backgroundColor.app,
    },
  ),
  closedCopy: style(
    flex({ direction: "column", alignItems: "center", gap: 3 }),
    {
      width: "100%",
      maxWidth: proseMaxWidth,
      textAlign: "center",
    },
  ),
};
