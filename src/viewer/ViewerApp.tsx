import { useEffect, useRef, useState } from "react";
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
import { viewerDocument } from "virtual:tkstack";
import { ComarkView } from "./ComarkView.tsx";
import { SourceDiffPanel, type SourceSelection } from "./SourceDiffPanel.js";
import { DoneButton } from "./DoneButton.tsx";
import { TableOfContents } from "./TableOfContents.tsx";

type ViewerMeta = {
  title: string;
};

export function ViewerApp() {
  const meta = useViewerMeta();
  const [selection, setSelection] = useState<SourceSelection>();
  const hasSourceDiffs =
    viewerDocument.sourceDiffs.length > 0 || viewerDocument.hasReferences;
  const body = useStyles(styles.body);
  const [shutDown, setShutDown] = useState(false);
  const title = meta === undefined ? document.title : meta.title;
  const shell = useStyles(styles.shell);
  const header = useStyles(styles.header);
  const heading = useStyles(styles.heading);
  const titleClass = useStyles(styles.title);
  const article = useStyles(styles.article);
  const prose = useStyles(styles.prose);
  const content = useStyles(proseHtml("md"), styles.content);
  const closed = useStyles(styles.closed);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (meta === undefined) return;
    document.title = meta.title;
  }, [meta]);

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (id === "") return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  if (shutDown) {
    return <main className={closed}>Closed.</main>;
  }

  return (
    <div className={shell}>
      <header className={header}>
        <div className={heading}>
          <div className={titleClass}>{title}</div>
        </div>
        <DoneButton
          onClick={() => {
            setShutDown(true);
            // oxlint-disable-next-line typescript/no-floating-promises -- React click callbacks cannot await the server shutdown request.
            void closeViewer();
          }}
        />
      </header>
      <div className={body} data-has-source-diffs={hasSourceDiffs}>
        <TableOfContents
          headings={viewerDocument.headings}
          articleRef={articleRef}
        />
        <article ref={articleRef} className={article}>
          <div className={prose}>
            <div className={content} data-tkstack-kind="page">
              <ComarkView
                document={viewerDocument}
                selectedAnnotation={selection?.annotation}
                onSelectAnnotation={(line) =>
                  setSelection({
                    annotation: line,
                    reference: line.references[0]!,
                  })
                }
              />
            </div>
          </div>
        </article>
        {hasSourceDiffs && (
          <SourceDiffPanel
            items={viewerDocument.sourceDiffs}
            selection={selection}
            onSelect={setSelection}
          />
        )}
      </div>
    </div>
  );
}

function useViewerMeta() {
  const [meta, setMeta] = useState<ViewerMeta>();
  useEffect(() => {
    // oxlint-disable-next-line typescript/no-floating-promises -- React effects cannot await; this request owns the metadata update.
    void fetch("/__tkstack/meta")
      .then((response) => response.json())
      .then((value) => {
        // SAFETY: the tkstack CLI serves this shape from extractTitle.
        setMeta(value as ViewerMeta);
      });
  }, []);
  return meta;
}

async function closeViewer() {
  await fetch("/__tkstack/shutdown", { method: "POST" });
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
  body: style({
    display: "grid",
    gridTemplateColumns: "var(--tkstack-columns)",
    "--tkstack-columns": "minmax(0, 1fr)",
    flex: "1 1 auto",
    minHeight: 0,
    minWidth: 0,
    position: "relative",
    "&[data-has-source-diffs='true']": {
      "--tkstack-columns": "minmax(0, 1fr) minmax(0, 1fr)",
    },
    "@media (max-width: 900px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gridTemplateRows: "minmax(0, 1fr) auto",
    },
  }),
  article: style(spacing.padding({ x: 12, y: 12 }), {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    backgroundColor: backgroundColor.app,
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
    "& ul > li[data-task] > .tkstack-task-checkbox, & ol > li[data-task] > .tkstack-task-checkbox":
      {
        // Maui proseHtml md listPadding.
        position: "absolute",
        left: "-20px",
        top: "6px",
      },
    "& .tkstack-task-checkbox label > span:last-child": {
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
