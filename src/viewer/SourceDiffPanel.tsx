import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { CodeView, type CodeViewHandle } from "@pierre/diffs/react";
import type {
  CodeViewItem,
  CodeViewOptions,
  CodeViewLineSelection,
} from "@pierre/diffs";
import {
  ActivityIndicator,
  backgroundColor,
  border,
  borderColor,
  colors,
  Button,
  ChevronDown,
  flex,
  motion,
  radius,
  shadow,
  spacing,
  Text,
  text,
  useTheme,
} from "maui";
import { style, useStyles } from "purse-styles";
import {
  referenceLabel,
  type SourceAnnotation,
  type SourceReference,
} from "../annotations.js";
import {
  changedFileItem,
  orderForReview,
  shortRev,
  type Changes,
  type Rev,
} from "../changes.js";
import type { SourceDefinition } from "../definitions.js";
import { useGistPin } from "../gist/pin.ts";
import { useGitHubPin } from "../github/pin.ts";
import { useHostFiles } from "../host/files.ts";
import { ChangesSummary } from "./ChangesCard.tsx";
import { useChanges } from "./changesSource.ts";
import { RangePicker } from "./RangePicker.tsx";
import { requestSource, useSourceReference } from "./sourceNavigation.js";
import {
  commentedLines,
  hashNumber,
  LineComment,
  lineNumbers,
  useLineComments,
} from "./lineComments.tsx";
import {
  diffLineText,
  pierreDiffOptions,
  sourceSelectionCss,
} from "./pierre.js";
import { sourcePanelPin } from "./sourceHeader.ts";
import { useViewerMode } from "./viewerMode.ts";

export type SourceSelection = {
  annotation: SourceAnnotation;
  reference: SourceReference;
};

type DefinitionNavigation = {
  selection: SourceSelection | undefined;
  history: SourceDefinition[];
  /** A definition request in flight, or the error it ended with. */
  request: "finding" | Error | undefined;
};

/** Everything the panel renders from; it keeps the last loaded page while the next one loads. */
type PanelPage = {
  rev: Rev;
  review: string[];
  selection: SourceSelection | undefined;
  history: SourceDefinition[];
  changes: Changes | Error | undefined;
  source: SourceDefinition | Error | undefined;
};

export function SourceDiffPanel(props: {
  /** The changes to show; references with their own rev open that rev instead. */
  rev: Rev;
  /** Paths to show first, in order, as the rev's changes card lists them. */
  review: string[];
  /** Local viewers pick other changes with the range picker. */
  onRevChange?: (rev: Rev) => void;
  selection: SourceSelection | undefined;
  onSelect: (selection: SourceSelection) => void;
}) {
  const { resolvedTheme } = useTheme();
  const mode = useViewerMode();
  const viewer = useRef<CodeViewHandle<string, undefined>>(null);
  const [navigation, setNavigation] = useState<DefinitionNavigation>({
    selection: props.selection,
    history: [],
    request: undefined,
  });
  if (navigation.selection !== props.selection) {
    setNavigation({
      selection: props.selection,
      history: [],
      request: undefined,
    });
  }
  const request = useRef(0);
  const hostFiles = useHostFiles();
  const nextChanges = useChanges(props.rev);
  const nextReference = props.selection?.reference;
  // A rev-less reference resolves against current files; a commit reference names its lines directly.
  const nextSource = useSourceReference(
    nextReference?.kind === "file" && nextReference.rev === undefined
      ? nextReference
      : undefined,
  );
  const loading =
    nextChanges === undefined
      ? "Loading changes…"
      : nextReference?.kind === "file" &&
          nextReference.rev === undefined &&
          nextSource === undefined &&
          (mode === "local" || mode === "github" || hostFiles !== undefined)
        ? "Opening source…"
        : navigation.request === "finding"
          ? "Finding definition…"
          : undefined;
  const next: PanelPage = {
    rev: props.rev,
    review: props.review,
    selection: props.selection,
    history: navigation.history,
    changes: nextChanges,
    source: nextSource,
  };
  // The new page replaces the old one only once it has loaded, so nothing half-loaded shows in between.
  const [page, setPage] = useState(next);
  if (
    loading === undefined &&
    (page.rev !== next.rev ||
      page.review !== next.review ||
      page.selection !== next.selection ||
      page.history !== next.history ||
      page.changes !== next.changes ||
      page.source !== next.source)
  ) {
    setPage(next);
  }
  const { history, selection, changes, source, review } = page;
  const definition = history.at(-1);
  const panel = useStyles(styles.panel);
  const header = useStyles(styles.header, styles.dimmed);
  const titleRow = useStyles(styles.titleRow);
  const titleClass = useStyles(styles.title);
  const pinClass = useStyles(styles.pin);
  const links = useStyles(styles.links);
  const code = useStyles(styles.code);
  const summary = useStyles(styles.summary);
  const codeWrap = useStyles(styles.codeWrap, styles.dimmed);
  const collapseIcon = useStyles(styles.collapseIcon);
  const github = useGitHubPin();
  const gist = useGistPin();
  const loadingClass = useStyles(styles.loading);
  const spinner = useStyles(styles.spinner);
  const reference = selection?.reference;
  const items = useMemo(() => {
    if (changes === undefined || changes instanceof Error) return [];
    const { reviewed, other } = orderForReview(changes.files, review);
    return [...reviewed, ...other].flatMap(
      (changed) => changedFileItem(changed) ?? [],
    );
  }, [changes, review]);
  const resolvedFile = source instanceof Error ? undefined : source;
  const inChanges =
    resolvedFile !== undefined &&
    items.some((item) => item.id === resolvedFile.path);
  const file =
    definition ??
    (resolvedFile !== undefined && changes !== undefined && !inChanges
      ? resolvedFile
      : undefined);
  const status =
    navigation.request instanceof Error
      ? navigation.request.message
      : source instanceof Error
        ? source.message
        : // A shown file replaces the changes, so their error is moot, as in a gist without uncommitted changes.
          changes instanceof Error && file === undefined
          ? changes.message
          : changes !== undefined && items.length === 0 && file === undefined
            ? "No changes."
            : undefined;
  const selectedLines = useMemo<CodeViewLineSelection | null>(() => {
    if (file !== undefined)
      return { id: file.path, range: { start: file.start, end: file.end } };
    const focus =
      resolvedFile ??
      (reference?.kind === "file" && reference.start !== undefined
        ? {
            path: reference.path,
            start: reference.start,
            end: reference.end ?? reference.start,
          }
        : undefined);
    // oxlint-disable-next-line unicorn/no-null -- Pierre uses null for a controlled empty selection.
    if (focus === undefined) return null;
    return {
      id: focus.path,
      range: { start: focus.start, end: focus.end, side: "additions" },
    };
  }, [reference, file, resolvedFile]);
  const focusedPath =
    file?.path ?? (reference?.kind === "file" ? reference.path : undefined);
  // Collapsed files reset when the rev or the selected reference changes, so a reference always shows its file.
  const [collapse, setCollapse] = useState<{
    rev: Rev;
    selection: SourceSelection | undefined;
    paths: ReadonlySet<string>;
  }>({ rev: page.rev, selection, paths: new Set() });
  if (collapse.rev !== page.rev || collapse.selection !== selection) {
    setCollapse({ rev: page.rev, selection, paths: new Set() });
  }
  const rangeId = selectedLines?.id;
  const rangeStart = selectedLines?.range.start;
  const rangeEnd = selectedLines?.range.end;
  const rangeSide =
    selectedLines !== null && "side" in selectedLines.range
      ? selectedLines.range.side
      : undefined;
  const shownItems = useMemo(
    () =>
      items.map((item) => {
        // The referenced file shows enough unchanged context to reveal its range.
        const changed =
          item.id === rangeId &&
          rangeSide === "additions" &&
          changes !== undefined &&
          !(changes instanceof Error)
            ? changes.files.find((entry) => entry.path === item.id)
            : undefined;
        const shown =
          changed === undefined
            ? item
            : (changedFileItem(changed, {
                start: rangeStart!,
                end: rangeEnd!,
              }) ?? item);
        const collapsed = collapse.paths.has(item.id);
        // Pierre only rereads an item when its version changes.
        return {
          ...shown,
          collapsed,
          version: (shown.version ?? 0) * 2 + (collapsed ? 1 : 0),
        };
      }),
    [items, changes, collapse.paths, rangeId, rangeStart, rangeEnd, rangeSide],
  );
  const toggleCollapsed = (path: string) => {
    const paths = new Set(collapse.paths);
    if (!paths.delete(path)) paths.add(path);
    setCollapse({ ...collapse, paths });
  };
  // File headers live in Pierre's shadow DOM; a click inside one names its file through the prefix slot.
  const onHeaderClick = (event: MouseEvent) => {
    if (file !== undefined) return;
    const fileHeader = event.nativeEvent
      .composedPath()
      .find(
        (target): target is Element =>
          target instanceof Element && target.hasAttribute("data-diffs-header"),
      );
    const root = fileHeader?.getRootNode();
    if (!(root instanceof ShadowRoot)) return;
    const path = root.host
      .querySelector("[data-collapse-path]")
      ?.getAttribute("data-collapse-path");
    if (path !== null && path !== undefined) toggleCollapsed(path);
  };

  const pin =
    file === undefined
      ? { kind: "none" as const }
      : sourcePanelPin({ path: file.path, github, gist });
  // Diffs keep Pierre's sticky per-file headers; a single file shows its path in the panel title.
  const showTitle = file !== undefined;
  const options = pierreDiffOptions({
    themeType: resolvedTheme,
    disableFileHeader: showTitle,
  });
  const loadedChanges =
    changes === undefined || changes instanceof Error ? undefined : changes;

  // Scroll again once the changes arrive, since Pierre cannot scroll to items it does not have yet.
  const ready = file !== undefined || loadedChanges !== undefined;
  useEffect(() => {
    if (!ready || focusedPath === undefined || rangeId !== undefined) return;
    viewer.current?.scrollTo({
      type: "item",
      id: focusedPath,
      align: "start",
      behavior: "instant",
    });
  }, [ready, focusedPath, rangeId]);

  useEffect(() => {
    if (
      !ready ||
      rangeId === undefined ||
      rangeStart === undefined ||
      rangeEnd === undefined
    ) {
      return;
    }
    viewer.current?.scrollTo({
      type: "range",
      id: rangeId,
      range: {
        start: rangeStart,
        end: rangeEnd,
        ...(rangeSide === undefined ? {} : { side: rangeSide }),
      },
      align: "center",
      behavior: "instant",
    });
  }, [ready, rangeId, rangeStart, rangeEnd, rangeSide]);

  const onTokenClick: CodeViewOptions<string, undefined>["onTokenClick"] = (
    token,
    event,
    context,
  ) => {
    if (mode !== "local") return;
    if (!event.metaKey && !event.ctrlKey) return;
    event.preventDefault();
    const item = context.item;
    let filePath: string;
    let lineText: string;
    if (item.type === "file") {
      filePath = item.file.name;
      lineText = item.file.contents.split(/\r?\n/)[token.lineNumber - 1]!;
    } else {
      const side =
        "side" in token && token.side === "deletions"
          ? "deletions"
          : "additions";
      filePath = item.fileDiff.name;
      lineText = diffLineText(item.fileDiff, side, token.lineNumber)!;
    }
    const params = new URLSearchParams({
      path: filePath,
      line: String(token.lineNumber),
      column: String(token.lineCharStart),
      text: lineText,
    });
    const currentRequest = ++request.current;
    setNavigation({ selection, history, request: "finding" });
    // oxlint-disable-next-line typescript/no-floating-promises -- Token callbacks cannot await; the request owns its status update.
    void requestSource("definition", params).then((result) => {
      if (currentRequest !== request.current) return;
      setNavigation((current) => {
        if (current.selection !== selection) return current;
        if (result instanceof Error) return { ...current, request: result };
        return {
          selection,
          history: [...history, result],
          request: undefined,
        };
      });
    });
  };

  // A diff's line numbers belong to its rev; a single file's to its current contents.
  const lineComments = useLineComments(
    file === undefined ? `panel:${page.rev}` : "panel-file",
  );
  const commentedItems = useMemo(() => {
    const baseItems: CodeViewItem<string>[] =
      file === undefined
        ? // SAFETY: changed-file items carry no annotations yet.
          (shownItems as CodeViewItem<string>[])
        : [
            {
              type: "file",
              id: file.path,
              file: { name: file.path, contents: file.contents },
            },
          ];
    return baseItems.map((item) => {
      const annotations =
        item.type === "file"
          ? lineComments.fileAnnotations(item.id)
          : lineComments.diffAnnotations(item.id);
      if (annotations.length === 0) return item;
      // Pierre only rereads an item's annotations when its version changes.
      const key = annotations
        .map((a) => `${a.metadata}@${String(a.lineNumber)}`)
        .join();
      return {
        ...item,
        annotations,
        version: hashNumber(`${String(item.version ?? 0)}:${key}`),
      } as CodeViewItem<string>;
    });
  }, [file, shownItems, lineComments]);
  const onGutterUtilityClick: CodeViewOptions<
    string,
    undefined
  >["onGutterUtilityClick"] = (range, context) => {
    const item = context.item;
    const { side = "additions", start, end } = commentedLines(range);
    if (item.type === "file") {
      lineComments.start({
        path: item.id,
        side: undefined,
        start,
        end,
        lineOffset: 0,
        lines: item.file.contents.split(/\r?\n/).slice(start - 1, end),
        context: "current file",
      });
      return;
    }
    lineComments.start({
      path: item.id,
      side,
      start,
      end,
      lineOffset: 0,
      lines: lineNumbers(start, end).flatMap(
        (line) => diffLineText(item.fileDiff, side, line) ?? [],
      ),
      context: `Diff panel: ${shortRev(page.rev)}`,
    });
  };

  return (
    <aside
      id="source-diff-panel"
      aria-label="Source changes"
      aria-busy={loading !== undefined}
      className={panel}
    >
      <div
        className={header}
        data-diffmap-kind="source-header"
        data-loading={loading !== undefined}
        // Pierre's file headers draw their own top border, which divides them from this header.
        data-file-headers={!showTitle && items.length > 0}
      >
        {!showTitle && props.onRevChange !== undefined && (
          <div className={titleRow}>
            <RangePicker rev={props.rev} onChange={props.onRevChange} />
            {loadedChanges !== undefined && (
              <ChangesSummary className={summary} changes={loadedChanges} />
            )}
          </div>
        )}
        {!showTitle &&
          props.onRevChange === undefined &&
          loadedChanges !== undefined && (
            <div className={titleRow}>
              {selection?.annotation.title !== undefined ? (
                <div className={titleClass} title={selection.annotation.title}>
                  {selection.annotation.title}
                </div>
              ) : loadedChanges.url === undefined ? (
                <div className={titleClass} title={loadedChanges.title}>
                  {loadedChanges.title}
                </div>
              ) : (
                <a
                  className={titleClass}
                  href={loadedChanges.url}
                  title={loadedChanges.title}
                >
                  {loadedChanges.title}
                </a>
              )}
            </div>
          )}
        {showTitle && (
          <div className={titleRow}>
            <div className={titleClass} title={file.path}>
              {file.path}
            </div>
            {definition !== undefined && (
              <Button
                variant="quiet"
                onClick={() => {
                  request.current++;
                  setNavigation({
                    selection,
                    history: history.slice(0, -1),
                    request: undefined,
                  });
                }}
              >
                {history.length === 1 ? "Back to reference" : "Back"}
              </Button>
            )}
          </div>
        )}
        {pin.kind === "github" && (
          <a
            className={pinClass}
            href={pin.href}
            data-diffmap-pin="github"
            title={pin.label}
          >
            {pin.label}
          </a>
        )}
        {pin.kind === "gist" && (
          <a
            className={pinClass}
            href={pin.href}
            data-diffmap-pin="gist"
            title={pin.label}
          >
            {pin.label}
          </a>
        )}
        {status !== undefined && <span role="status">{status}</span>}
        {selection !== undefined &&
          selection.annotation.references.length > 1 && (
            <div className={links} aria-label="Linked changes">
              {selection.annotation.references.map((option, index) => (
                <Button
                  key={index}
                  variantColor="blue"
                  variant={option === selection.reference ? "primary" : "quiet"}
                  onClick={() =>
                    props.onSelect({
                      annotation: selection.annotation,
                      reference: option,
                    })
                  }
                >
                  {referenceLabel(option)}
                </Button>
              ))}
            </div>
          )}
      </div>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Pierre's file headers are the click targets; this only catches their clicks. */}
      <div
        className={codeWrap}
        data-loading={loading !== undefined}
        // The last page stays visible while the next one loads, but it is no longer the one to act on.
        inert={loading !== undefined}
        onClick={onHeaderClick}
      >
        <CodeView
          ref={viewer}
          className={code}
          items={commentedItems}
          selectedLines={selectedLines}
          disableWorkerPool
          options={{
            ...options,
            unsafeCSS:
              options.unsafeCSS + sourceSelectionCss + panelBackgroundCss,
            // Files stack flush under the header, with no gaps between them.
            layout: { paddingTop: 0, paddingBottom: 0, gap: 0 },
            stickyHeaders: true,
            onTokenClick,
            enableGutterUtility: true,
            onGutterUtilityClick,
          }}
          renderAnnotation={(...[annotation]) => (
            <LineComment id={annotation.metadata} />
          )}
          renderHeaderPrefix={(item) => (
            <span
              className={collapseIcon}
              data-collapse-path={item.id}
              data-collapsed={collapse.paths.has(item.id)}
              aria-hidden="true"
            >
              <ChevronDown size="sm" />
            </span>
          )}
        />
      </div>
      <div
        className={loadingClass}
        role="status"
        data-loading={loading !== undefined}
      >
        {loading !== undefined && (
          // Inline in the label, the spinner sits on the text's baseline at its size, so it lines up in any font.
          <Text size="sm" color="lowContrast">
            <ActivityIndicator className={spinner} />
            {loading}
          </Text>
        )}
      </div>
    </aside>
  );
}

/** Pierre paints its own white; the panel's background shows through instead. */
const panelBackgroundCss = `:host { --diffs-light-bg: ${backgroundColor.app}; --diffs-dark-bg: ${backgroundColor.app}; }
[data-diffs-header] { border-top: 1px solid ${borderColor.border}; cursor: pointer; }`;

const styles = {
  panel: style(flex({ direction: "column" }), border(["left"], "border"), {
    position: "relative",
    gridArea: "diff",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
    "@media (max-width: 900px)": {
      height: "45vh",
      borderLeft: "none",
      borderTop: `1px solid ${borderColor.border}`,
    },
  }),
  header: style(
    flex({ direction: "column" }),
    // Same vertical padding as the page header; the inline padding lines the
    // picker's icon and label up with Pierre's file headers below.
    spacing.padding({ y: 3 }),
    { paddingInline: "7px" },
    border(["bottom"], "border"),
    text({ size: "sm", color: "lowContrast" }),
    {
      "&[data-file-headers='true']": { borderBottom: "none" },
      gap: "6px",
      minWidth: 0,
      maxHeight: "35%",
      overflowY: "auto",
      flexShrink: 0,
    },
  ),
  // Pierre's file headers pad 16px; this header pads 7px.
  summary: style({ marginLeft: "auto", marginRight: "9px" }),
  titleRow: style(flex({ direction: "row", alignItems: "center" }), {
    gap: "6px",
    minWidth: 0,
  }),
  title: style(text({ size: "sm", fontWeight: 600, color: "highContrast" }), {
    minWidth: 0,
    flex: "1 1 auto",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  pin: style(text({ size: "sm", color: "lowContrast" }), {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textDecoration: "none",
    "&:is(a):hover": {
      textDecoration: "underline",
    },
  }),
  links: style(flex({ direction: "row" }), { gap: "6px", flexWrap: "wrap" }),
  codeWrap: style({
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
  }),
  // Loads that finish within the delay swap pages without dimming.
  dimmed: style(motion.standard("opacity"), {
    "&[data-loading='true']": { opacity: 0.4, transitionDelay: "150ms" },
  }),
  loading: style(
    radius.md,
    shadow.medium,
    spacing.padding({ x: 6, y: 3 }),
    motion.standard("opacity"),
    {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      whiteSpace: "nowrap",
      backgroundColor: backgroundColor.app,
      pointerEvents: "none",
      opacity: 0,
      "&[data-loading='true']": { opacity: 1, transitionDelay: "150ms" },
    },
  ),
  spinner: style({ marginRight: spacing.value(4) }),
  collapseIcon: style({
    display: "flex",
    color: colors.gray[11],
    transition: "transform 150ms ease-out",
    "&[data-collapsed='true']": { transform: "rotate(-90deg)" },
  }),
  code: style({
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
  }),
};
