import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { CodeView, type CodeViewHandle } from "@pierre/diffs/react";
import type { CodeViewOptions, CodeViewLineSelection } from "@pierre/diffs";
import {
  backgroundColor,
  border,
  borderColor,
  colors,
  Button,
  ChevronDown,
  flex,
  spacing,
  text,
  useTheme,
} from "maui";
import { style, useStyles } from "purse-styles";
import {
  referenceLabel,
  type SourceAnnotation,
  type SourceReference,
} from "../annotations.js";
import { changedFileItem, type Rev } from "../changes.js";
import type { SourceDefinition } from "../definitions.js";
import { useGistPin } from "../gist/pin.ts";
import { useGitHubPin } from "../github/pin.ts";
import { useHostFiles } from "../host/files.ts";
import { ChangesSummary } from "./ChangesCard.tsx";
import { useChanges } from "./changesSource.ts";
import { RangePicker } from "./RangePicker.tsx";
import { requestSource, useSourceReference } from "./sourceNavigation.js";
import { pierreDiffOptions, sourceSelectionCss } from "./pierre.js";
import { sourcePanelPin } from "./sourceHeader.ts";
import { useViewerMode } from "./viewerMode.ts";

export type SourceSelection = {
  annotation: SourceAnnotation;
  reference: SourceReference;
};

type DefinitionNavigation = {
  selection: SourceSelection | undefined;
  history: SourceDefinition[];
  status: string | undefined;
};

export function SourceDiffPanel(props: {
  /** The changes to show; references with their own rev open that rev instead. */
  rev: Rev;
  /** Local viewers pick other changes with the range picker. */
  onRevChange?: (rev: Rev) => void;
  selection: SourceSelection | undefined;
  onSelect: (selection: SourceSelection) => void;
}) {
  const { resolvedTheme } = useTheme();
  const mode = useViewerMode();
  const viewer = useRef<CodeViewHandle<undefined, undefined>>(null);
  const [navigation, setNavigation] = useState<DefinitionNavigation>({
    selection: props.selection,
    history: [],
    status: undefined,
  });
  if (navigation.selection !== props.selection) {
    setNavigation({
      selection: props.selection,
      history: [],
      status: undefined,
    });
  }
  const { history } = navigation;
  const request = useRef(0);
  const definition = history.at(-1);
  const panel = useStyles(styles.panel);
  const header = useStyles(styles.header);
  const titleRow = useStyles(styles.titleRow);
  const titleClass = useStyles(styles.title);
  const pinClass = useStyles(styles.pin);
  const links = useStyles(styles.links);
  const code = useStyles(styles.code);
  const summary = useStyles(styles.summary);
  const codeWrap = useStyles(styles.codeWrap);
  const collapseIcon = useStyles(styles.collapseIcon);
  const github = useGitHubPin();
  const gist = useGistPin();
  const hostFiles = useHostFiles();
  const selection = props.selection;
  const reference = selection?.reference;
  const changes = useChanges(props.rev);
  const items = useMemo(
    () =>
      changes === undefined || changes instanceof Error
        ? []
        : changes.files.flatMap((changed) => changedFileItem(changed) ?? []),
    [changes],
  );
  // A rev-less reference resolves against current files; a commit reference names its lines directly.
  const source = useSourceReference(
    reference?.kind === "file" && reference.rev === undefined
      ? reference
      : undefined,
  );
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
    navigation.status !== undefined
      ? navigation.status
      : source instanceof Error
        ? source.message
        : changes instanceof Error
          ? changes.message
          : changes === undefined
            ? "Loading changes…"
            : reference?.kind === "file" &&
                reference.rev === undefined &&
                source === undefined &&
                (mode === "local" ||
                  mode === "github" ||
                  hostFiles !== undefined)
              ? "Opening source…"
              : items.length === 0 && file === undefined
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
  const focusedPath = file?.path ?? reference?.path;
  // Collapsed files reset when the rev or the selected reference changes, so a reference always shows its file.
  const [collapse, setCollapse] = useState<{
    rev: Rev;
    selection: SourceSelection | undefined;
    paths: ReadonlySet<string>;
  }>({ rev: props.rev, selection, paths: new Set() });
  if (collapse.rev !== props.rev || collapse.selection !== selection) {
    setCollapse({ rev: props.rev, selection, paths: new Set() });
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
    if (
      !ready ||
      selection === undefined ||
      focusedPath === undefined ||
      rangeId !== undefined
    )
      return;
    viewer.current?.scrollTo({
      type: "item",
      id: focusedPath,
      align: "start",
      behavior: "instant",
    });
  }, [ready, focusedPath, rangeId, selection]);

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

  const onTokenClick: CodeViewOptions<undefined, undefined>["onTokenClick"] = (
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
        "side" in token && token.side === "deletions" ? "deletion" : "addition";
      const diff = item.fileDiff;
      filePath = diff.name;
      const hunk = diff.hunks.find(
        (h) =>
          token.lineNumber >= h[`${side}Start`] &&
          token.lineNumber < h[`${side}Start`] + h[`${side}Count`],
      )!;
      const index = diff.isPartial
        ? hunk[`${side}LineIndex`] + token.lineNumber - hunk[`${side}Start`]
        : token.lineNumber - 1;
      lineText = diff[`${side}Lines`][index]!.replace(/\r?\n$/, "");
    }
    const params = new URLSearchParams({
      path: filePath,
      line: String(token.lineNumber),
      column: String(token.lineCharStart),
      text: lineText,
    });
    const currentRequest = ++request.current;
    setNavigation({ selection, history, status: "Finding definition…" });
    // oxlint-disable-next-line typescript/no-floating-promises -- Token callbacks cannot await; the request owns its status update.
    void requestSource("definition", params).then((result) => {
      if (currentRequest !== request.current) return;
      setNavigation((current) => {
        if (current.selection !== selection) return current;
        if (result instanceof Error)
          return { ...current, status: result.message };
        return {
          selection,
          history: [...history, result],
          status: undefined,
        };
      });
    });
  };

  return (
    <aside id="source-diff-panel" aria-label="Source changes" className={panel}>
      <div
        className={header}
        data-diffmap-kind="source-header"
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
              {loadedChanges.url === undefined ? (
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
                    status: undefined,
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
      <div className={codeWrap} onClick={onHeaderClick}>
        <CodeView
          ref={viewer}
          className={code}
          items={
            file === undefined
              ? shownItems
              : [
                  {
                    type: "file",
                    id: file.path,
                    file: {
                      name: file.path,
                      contents: file.contents,
                    },
                  },
                ]
          }
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
          }}
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
    </aside>
  );
}

/** Pierre paints its own white; the panel's background shows through instead. */
const panelBackgroundCss = `:host {
  --diffs-light-bg: ${backgroundColor.app};
  --diffs-dark-bg: ${backgroundColor.app};
  --diffs-bg-separator-override: ${colors.gray[2]};
}
[data-diffs-header] {
  background-color: ${colors.gray[4]};
  color: ${colors.gray[12]};
  border-top: 1px solid ${borderColor.border};
  cursor: pointer;
}`;

const styles = {
  panel: style(flex({ direction: "column" }), border(["left"], "border"), {
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
