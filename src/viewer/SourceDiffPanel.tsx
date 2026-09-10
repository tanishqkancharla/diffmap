import { useEffect, useMemo, useRef, useState } from "react";
import { CodeView, type CodeViewHandle } from "@pierre/diffs/react";
import type {
  CodeViewDiffItem,
  CodeViewOptions,
  CodeViewLineSelection,
} from "@pierre/diffs";
import {
  backgroundColor,
  border,
  Button,
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
import type { SourceDefinition } from "../definitions.js";
import {
  matchingSourceDiff,
  requestSource,
  useSourceReference,
} from "./sourceNavigation.js";
import { pierreDiffOptions, sourceSelectionCss } from "./pierre.js";

export type SourceSelection = {
  annotation: SourceAnnotation;
  reference: SourceReference | undefined;
};

type DefinitionNavigation = {
  selection: SourceSelection | undefined;
  history: SourceDefinition[];
  status: string | undefined;
};

export function SourceDiffPanel(props: {
  items: CodeViewDiffItem[];
  selection: SourceSelection | undefined;
  onSelect: (selection: SourceSelection) => void;
}) {
  const { resolvedTheme } = useTheme();
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
  const [pendingSymbol, setPendingSymbol] = useState<{
    params: URLSearchParams;
    label: string;
    selection: SourceSelection | undefined;
  }>();
  const request = useRef(0);
  const definition = history.at(-1);
  const panel = useStyles(styles.panel);
  const header = useStyles(styles.header);
  const links = useStyles(styles.links);
  const code = useStyles(styles.code);
  const options = pierreDiffOptions({
    themeType: resolvedTheme,
    disableFileHeader: false,
  });
  const selection = props.selection;
  const source = useSourceReference(selection?.reference);
  const resolvedFile = source instanceof Error ? undefined : source;
  const linkedDiff = useMemo(
    () =>
      resolvedFile === undefined
        ? undefined
        : matchingSourceDiff(resolvedFile, props.items),
    [resolvedFile, props.items],
  );
  const file =
    definition === undefined
      ? linkedDiff === undefined
        ? resolvedFile
        : undefined
      : definition;
  const status =
    navigation.status !== undefined
      ? navigation.status
      : source instanceof Error
        ? source.message
        : selection?.reference?.kind === "file" && source === undefined
          ? "Opening source…"
          : undefined;
  const selectedLines = useMemo<CodeViewLineSelection | null>(() => {
    if (file !== undefined)
      return { id: file.path, range: { start: file.start, end: file.end } };
    if (linkedDiff !== undefined) return linkedDiff;
    const ref = selection?.reference;
    // oxlint-disable-next-line unicorn/no-null -- Pierre uses null for a controlled empty selection.
    if (ref === undefined || ref.kind === "file") return null;
    return {
      id: ref.id,
      range: {
        start: ref.start,
        end: ref.end,
        side: ref.side === "old" ? "deletions" : "additions",
      },
    };
  }, [selection, file, linkedDiff]);

  useEffect(() => {
    if (selectedLines === null) return;
    viewer.current?.scrollTo({
      type: "range",
      ...selectedLines,
      align: "center",
      behavior: "instant",
    });
  }, [selectedLines]);

  const onTokenClick: CodeViewOptions<undefined, undefined>["onTokenClick"] = (
    token,
    event,
    context,
  ) => {
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
    if (!event.metaKey && !event.ctrlKey) {
      setPendingSymbol({ params, label: token.tokenText, selection });
      return;
    }
    navigate(params);
  };

  const navigate = (params: URLSearchParams) => {
    setPendingSymbol(undefined);
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
    <aside
      id="source-diff-panel"
      aria-label="Source changes"
      className={panel}
      onClickCapture={(event) => {
        if (!file) return;
        const elements = event.nativeEvent
          .composedPath()
          .filter((item): item is HTMLElement => item instanceof HTMLElement);
        const token = elements.find((item) => item.hasAttribute("data-char"));
        const line = elements.find((item) => item.hasAttribute("data-line"));
        if (!token || !line) return;
        event.stopPropagation();
        const lineNumber = Number(line.dataset.line);
        const params = new URLSearchParams({
          path: file.path,
          line: String(lineNumber),
          column: token.dataset.char!,
          text: file.contents.split(/\r?\n/)[lineNumber - 1]!,
        });
        if (!event.metaKey && !event.ctrlKey) {
          setPendingSymbol({
            params,
            label: token.textContent ?? "symbol",
            selection,
          });
          return;
        }
        event.preventDefault();
        navigate(params);
      }}
    >
      <div className={header}>
        <strong>
          {definition !== undefined
            ? "Symbol definition"
            : file !== undefined
              ? "Source file"
              : "Source changes"}
        </strong>
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
        <span>⌘-click or Ctrl-click a symbol to go to its definition.</span>
        {pendingSymbol && pendingSymbol.selection === selection && (
          <Button
            variant="quiet"
            onClick={() => navigate(pendingSymbol.params)}
          >
            Open definition: {pendingSymbol.label}
          </Button>
        )}
        {status !== undefined && <span role="status">{status}</span>}
        {selection === undefined ? (
          <span>
            Select a linked stack row or diagram element to open its source.
          </span>
        ) : (
          <>
            <span>
              {selection.annotation.text.replace(/^[+ -]/, "").trim()}
            </span>
            {selection.annotation.references.length > 1 && (
              <div className={links} aria-label="Linked changes">
                {selection.annotation.references.map((reference, index) => (
                  <Button
                    key={index}
                    variantColor="blue"
                    variant={
                      reference === selection.reference ? "primary" : "quiet"
                    }
                    onClick={() =>
                      props.onSelect({
                        annotation: selection.annotation,
                        reference,
                      })
                    }
                  >
                    {referenceLabel(reference)}
                  </Button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <CodeView
        ref={viewer}
        className={code}
        items={
          file === undefined
            ? selection?.reference?.kind === "file" &&
              resolvedFile === undefined
              ? []
              : props.items
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
          unsafeCSS: options.unsafeCSS + sourceSelectionCss,
          stickyHeaders: true,
          onTokenClick,
          useTokenTransformer: true,
        }}
      />
    </aside>
  );
}

const styles = {
  panel: style(flex({ direction: "column" }), border(["left"], "border"), {
    minWidth: 0,
    minHeight: 0,
    backgroundColor: backgroundColor.app,
    "@media (max-width: 900px)": {
      borderLeft: 0,
      borderTop: "1px solid",
      height: "45vh",
    },
  }),
  header: style(
    flex({ direction: "column" }),
    spacing.padding({ all: 4 }),
    border(["bottom"], "border"),
    text({ size: "sm", color: "lowContrast" }),
    {
      gap: "6px",
      overflowWrap: "anywhere",
      maxHeight: "35%",
      overflowY: "auto",
      flexShrink: 0,
    },
  ),
  links: style(flex({ direction: "row" }), { gap: "6px", flexWrap: "wrap" }),
  code: style({
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
  }),
};
