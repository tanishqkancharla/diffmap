import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  backgroundColor,
  borderColor,
  Button,
  Check,
  ChevronDown,
  colors,
  focusRing,
  GitBranch,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import {
  revWindow,
  shortRev,
  windowLabel,
  windowRev,
  type Delta,
  type DeltaWindow,
  type Rev,
} from "../changes.js";
import { codeFontFamily } from "../codeFont.js";
import { loadLocalDeltas } from "./changesSource.ts";

const ROW = 28;

/**
 * "All commits" menu: unstaged, staged, then the branch's commits. Click a
 * row for one change; drag the handles between rows, or drag across rows, for
 * a window.
 */
export function RangePicker(props: { rev: Rev; onChange: (rev: Rev) => void }) {
  const [open, setOpen] = useState(false);
  const [deltas, setDeltas] = useState<Delta[] | Error>();
  // The window being dragged; it is applied on release.
  const [dragging, setDragging] = useState<DeltaWindow>();
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const rows = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const trigger = useStyles(styles.trigger);
  const float = useStyles(styles.float);
  const item = useStyles(styles.item);
  const row = useStyles(styles.row);
  const handle = useStyles(styles.handle);
  const foot = useStyles(styles.foot);

  // Read once for the label, and again on each open: commits and uncommitted changes move.
  // The list reaches back to the open rev, so it always shows as picked.
  const refresh = () => {
    // oxlint-disable-next-line typescript/no-floating-promises -- The picker owns this request; a late result only updates its rows.
    void loadLocalDeltas(props.rev).then(setDeltas);
  };
  useEffect(() => {
    // oxlint-disable-next-line typescript/no-floating-promises -- The picker owns this request; a late result only updates its rows.
    void loadLocalDeltas(props.rev).then(setDeltas);
  }, [props.rev]);

  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (popover.current?.contains(target) || button.current?.contains(target))
        return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const list = deltas instanceof Error ? undefined : deltas;
  const picked = list === undefined ? undefined : revWindow(list, props.rev);
  const shown = dragging ?? picked;
  const label =
    list !== undefined && shown !== undefined
      ? windowLabel(list, shown)
      : shortRev(props.rev).replace("..", "…");

  // Open on the picked rows, even when they sit far down the list.
  const pickedNewest = picked?.newest;
  useEffect(() => {
    if (!open || pickedNewest === undefined) return;
    rows.current?.children[pickedNewest]?.scrollIntoView({ block: "center" });
  }, [open, pickedNewest]);

  const apply = (window: DeltaWindow) => {
    setDragging(undefined);
    if (list === undefined) return;
    props.onChange(windowRev(list, window));
  };
  // Row boundary under the pointer: 0 is above the first row, N below the last.
  const boundaryAt = (event: { clientY: number }) =>
    Math.round(
      (event.clientY - rows.current!.getBoundingClientRect().top) / ROW,
    );

  const dragHandle = (event: PointerEvent, end: "newest" | "oldest") => {
    if (list === undefined || shown === undefined) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = shown;
    let next = start;
    const target = event.currentTarget as HTMLElement;
    const move = (moveEvent: globalThis.PointerEvent) => {
      const boundary = boundaryAt(moveEvent);
      next =
        end === "newest"
          ? { ...start, newest: Math.max(0, Math.min(boundary, start.oldest)) }
          : {
              ...start,
              oldest: Math.min(
                list.length - 1,
                Math.max(boundary - 1, start.newest),
              ),
            };
      setDragging(next);
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      apply(next);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  const dragRows = (event: PointerEvent, index: number) => {
    if (list === undefined || event.button !== 0) return;
    event.preventDefault();
    const container = rows.current!;
    container.setPointerCapture(event.pointerId);
    let next = { newest: index, oldest: index };
    setDragging(next);
    const move = (moveEvent: globalThis.PointerEvent) => {
      const over = Math.max(
        0,
        Math.min(
          list.length - 1,
          Math.floor(
            (moveEvent.clientY - container.getBoundingClientRect().top) / ROW,
          ),
        ),
      );
      next = {
        newest: Math.min(index, over),
        oldest: Math.max(index, over),
      };
      setDragging(next);
    };
    const up = () => {
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerup", up);
      container.removeEventListener("pointercancel", up);
      apply(next);
    };
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerup", up);
    container.addEventListener("pointercancel", up);
  };

  const nudge = (end: "newest" | "oldest", by: number) => {
    if (list === undefined || shown === undefined) return;
    apply(
      end === "newest"
        ? {
            ...shown,
            newest: Math.max(0, Math.min(shown.oldest, shown.newest + by)),
          }
        : {
            ...shown,
            oldest: Math.min(
              list.length - 1,
              Math.max(shown.newest, shown.oldest + by),
            ),
          },
    );
  };

  return (
    <>
      <Button
        ref={button}
        className={trigger}
        variant="quiet"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          const rect = button.current!.getBoundingClientRect();
          const icon = button
            .current!.querySelector("svg")!
            .getBoundingClientRect();
          // Line the menu's icons and rail up under the trigger's icon.
          setAnchor({ top: rect.bottom + 4, left: icon.left - INSET });
          if (!open) refresh();
          setOpen(!open);
        }}
      >
        <GitBranch size="sm" />
        <span>{label}</span>
        <ChevronDown size="sm" />
      </Button>
      {open &&
        createPortal(
          <div
            ref={popover}
            className={float}
            role="dialog"
            aria-label="Pick changes"
            style={anchor}
          >
            {deltas instanceof Error ? (
              <div className={foot}>{deltas.message}</div>
            ) : list === undefined ? (
              <div className={foot}>Loading changes…</div>
            ) : (
              <>
                <button
                  type="button"
                  className={item}
                  data-selected={
                    shown?.newest === 0 && shown.oldest === list.length - 1
                  }
                  onClick={() => apply({ newest: 0, oldest: list.length - 1 })}
                >
                  <GitBranch size="sm" />
                  <span>All commits</span>
                  {shown?.newest === 0 && shown.oldest === list.length - 1 && (
                    <Check size="sm" />
                  )}
                </button>
                <div className="scroll">
                  <div ref={rows} className="rows">
                    {list.map((delta, index) => {
                      const inside =
                        shown !== undefined &&
                        index >= shown.newest &&
                        index <= shown.oldest;
                      return (
                        <button
                          key={delta.kind === "commit" ? delta.sha : delta.kind}
                          type="button"
                          className={row}
                          data-inside={inside}
                          data-kind={delta.kind}
                          data-first={index === 0}
                          data-last={index === list.length - 1}
                          title={
                            delta.kind === "commit"
                              ? `${delta.sha.slice(0, 7)} ${delta.subject}`
                              : undefined
                          }
                          onPointerDown={(event) => dragRows(event, index)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ")
                              return;
                            event.preventDefault();
                            apply({ newest: index, oldest: index });
                          }}
                        >
                          <span className="rail" aria-hidden="true">
                            <span className="dot" />
                          </span>
                          {delta.kind === "commit" ? (
                            <span className="label">
                              <span className="sha">
                                {delta.sha.slice(0, 7)}
                              </span>
                              <span className="subject">{delta.subject}</span>
                            </span>
                          ) : (
                            <span className="label">
                              {delta.kind === "staged" ? "Staged" : "Unstaged"}
                            </span>
                          )}
                          <span className="stat">
                            {delta.additions > 0 && (
                              <span className="added">+{delta.additions}</span>
                            )}
                            {delta.deletions > 0 && (
                              <span className="removed">
                                −{delta.deletions}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                    {shown !== undefined && (
                      <>
                        <span
                          className="window"
                          aria-hidden="true"
                          style={{
                            top: shown.newest * ROW,
                            height: (shown.oldest - shown.newest + 1) * ROW,
                          }}
                        />
                        <button
                          type="button"
                          className={handle}
                          style={{ top: shown.newest * ROW }}
                          aria-label="Newest change in the range"
                          onPointerDown={(event) => dragHandle(event, "newest")}
                          onKeyDown={(event) => {
                            const by = { ArrowUp: -1, ArrowDown: 1 }[event.key];
                            if (by === undefined) return;
                            event.preventDefault();
                            nudge("newest", by);
                          }}
                        />
                        <button
                          type="button"
                          className={handle}
                          style={{ top: (shown.oldest + 1) * ROW }}
                          aria-label="Oldest change in the range"
                          onPointerDown={(event) => dragHandle(event, "oldest")}
                          onKeyDown={(event) => {
                            const by = { ArrowUp: -1, ArrowDown: 1 }[event.key];
                            if (by === undefined) return;
                            event.preventDefault();
                            nudge("oldest", by);
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
                <div className={foot}>
                  Click a change, or drag the handles for a range.
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Maui menu items' inline padding (spacing 4), before each row's icon or rail dot. */
const INSET = 9;
/** The rail column is as wide as a small icon, so dots sit under icons. */
const RAIL = 16;

const styles = {
  trigger: style(text({ size: "md", fontWeight: 400, color: "highContrast" }), {
    gap: "8px",
    minWidth: 0,
    "& > span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  }),
  // Maui's menu popover: element surface, small radius, strong shadow, rows edge to edge.
  float: style(
    radius.sm,
    shadow.strong,
    spacing.padding({ y: 1 }),
    text({ size: "sm", color: "highContrast" }),
    {
      position: "fixed",
      zIndex: 50,
      width: "400px",
      maxWidth: "calc(100vw - 32px)",
      backgroundColor: backgroundColor.element,
      "& .scroll": {
        maxHeight: "min(60vh, 520px)",
        overflowY: "auto",
        // Room for the handles that sit on the first and last boundaries.
        paddingBlock: "6px",
        borderBlock: `1px solid ${borderColor.border}`,
        marginBlock: "2px",
      },
      "& .rows": { position: "relative", touchAction: "none" },
      // The picked window runs down the rail, between the two handles.
      "& .window": {
        position: "absolute",
        left: `${String(INSET + RAIL / 2 - 1)}px`,
        width: "2px",
        borderRadius: "1px",
        backgroundColor: colors.accent[9],
        pointerEvents: "none",
      },
    },
  ),
  item: style(
    {
      paddingInline: `${String(INSET)}px`,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      width: "100%",
      height: `${String(ROW)}px`,
      border: 0,
      background: "transparent",
      font: "inherit",
      color: "inherit",
      textAlign: "left",
      cursor: "default",
      "& > span": { flex: "1 1 auto" },
      "& > svg": { flexShrink: 0 },
      "&:hover": { backgroundColor: backgroundColor.elementHover },
      // Maui's selected menu item: accent text, medium weight, a check.
      "&[data-selected='true']": { color: colors.accent[9], fontWeight: 500 },
    },
    focusRing(),
  ),
  row: style(
    {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      width: "100%",
      height: `${String(ROW)}px`,
      paddingInline: `${String(INSET)}px`,
      border: 0,
      background: "transparent",
      font: "inherit",
      color: "inherit",
      textAlign: "left",
      cursor: "default",
      userSelect: "none",
      "&:hover": { backgroundColor: backgroundColor.elementHover },
      "&[data-inside='true']": { color: colors.accent[9], fontWeight: 500 },
      "& .rail": {
        position: "relative",
        alignSelf: "stretch",
        width: `${String(RAIL)}px`,
        flexShrink: 0,
      },
      // The rail runs through the center of every row.
      "& .rail::before": {
        content: "''",
        position: "absolute",
        left: "calc(50% - 0.5px)",
        top: 0,
        bottom: 0,
        borderLeft: `1px solid ${colors.gray[6]}`,
      },
      "&[data-first='true'] .rail::before": { top: "50%" },
      "&[data-last='true'] .rail::before": { bottom: "50%" },
      "& .dot": {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: "7px",
        height: "7px",
        margin: "-3.5px 0 0 -3.5px",
        borderRadius: "50%",
        backgroundColor: colors.gray[9],
      },
      "&[data-kind='staged'] .dot, &[data-kind='unstaged'] .dot": {
        backgroundColor: backgroundColor.app,
        boxShadow: `inset 0 0 0 1.5px ${colors.gray[9]}`,
      },
      "&[data-inside='true'] .dot": {
        backgroundColor: colors.accent[9],
        boxShadow: "none",
      },
      "& .label": {
        display: "flex",
        gap: "8px",
        flex: "1 1 auto",
        minWidth: 0,
      },
      "& .sha": { fontFamily: codeFontFamily, flexShrink: 0 },
      "& .subject": {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
      "& .stat": {
        display: "flex",
        gap: "6px",
        fontWeight: 400,
        flexShrink: 0,
        fontFamily: codeFontFamily,
        fontSize: "12px",
        fontVariantNumeric: "tabular-nums",
      },
      "& .added": { color: colors.green[11] },
      "& .removed": { color: colors.red[11] },
    },
    focusRing(),
  ),
  // Sits on the boundary between two rows, centered on the rail.
  handle: style(
    {
      position: "absolute",
      left: `${String(INSET + RAIL / 2 - 8)}px`,
      width: "16px",
      height: "8px",
      marginTop: "-4px",
      padding: 0,
      border: 0,
      borderRadius: "4px",
      backgroundColor: backgroundColor.app,
      boxShadow: `inset 0 0 0 2px ${colors.accent[9]}`,
      cursor: "ns-resize",
      touchAction: "none",
      zIndex: 1,
    },
    focusRing(undefined, `inset 0 0 0 2px ${colors.accent[9]}`),
  ),
  foot: style(
    spacing.padding({ x: 4, y: 1 }),
    text({ size: "xs", color: "lowContrast" }),
  ),
};
