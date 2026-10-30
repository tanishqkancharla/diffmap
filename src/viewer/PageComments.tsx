import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { buttonStyles, colors, Message, shadowVars } from "maui";
import { style, useStyles } from "purse-styles";
import { CommentCard } from "./CommentCard.tsx";
import {
  useComments,
  type ReviewComment,
  type TextAnchor,
} from "./comments.ts";
import {
  anchorFromRange,
  anchorRect,
  rangeForAnchor,
  textIndex,
} from "./textAnchors.ts";

/** Space between the text column and the comment cards. */
const MARGIN_GAP = 24;
const EDGE_GAP = 16;
const CARD_MIN = 220;
const CARD_MAX = 300;
const NARROW_CARD_MAX = 360;
const STACK_GAP = 8;
const DRAFT = "draft";

type Box = { top: number; bottom: number; left: number; right: number };

/** Where things sit, in pixels from the layer's top left. */
type Layout = {
  width: number;
  contentLeft: number;
  contentRight: number;
  /** Each comment's highlighted text; undefined when it is no longer on the page. */
  anchors: Record<string, Box | undefined>;
};

type TextComment = ReviewComment & { anchor: TextAnchor };

/**
 * Comments on highlighted page text. With room beside the text column, every
 * card sits in the right margin next to its text, like Google Docs. Without
 * it, only the draft or the clicked highlight's card shows, under its text.
 */
export function PageComments(props: {
  contentRef: RefObject<HTMLElement | null>;
}) {
  const store = useComments();
  const layerRef = useRef<HTMLDivElement>(null);
  const ranges = useRef(new Map<string, Range>());
  const [layout, setLayout] = useState<Layout>();
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [selection, setSelection] = useState<{
    range: Range;
    display: string;
    box: Box;
  }>();
  const [cardObserver] = useState(
    () =>
      new ResizeObserver((entries) => {
        setHeights((current) => {
          const next = { ...current };
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.commentId;
            if (id !== undefined) next[id] = entry.borderBoxSize[0]!.blockSize;
          }
          return next;
        });
      }),
  );
  const layer = useStyles(styles.layer);
  const slot = useStyles(styles.slot);
  const addButton = useStyles(
    buttonStyles.root({ variant: "default", size: "sm" }),
    styles.add,
  );
  const addLabel = useStyles(buttonStyles.label);
  const comments = store.comments.filter(
    (comment): comment is TextComment => comment.anchor.kind === "text",
  );
  const draft = store.draft?.kind === "text" ? store.draft : undefined;

  const measure = useEffectEvent(() => {
    const content = props.contentRef.current;
    const layerElement = layerRef.current;
    if (content === null || layerElement === null) return;
    const index = textIndex(content);
    const origin = layerElement.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const anchors: Layout["anchors"] = {};
    const highlighted: Range[] = [];
    const active: Range[] = [];
    ranges.current.clear();
    const place = (id: string, anchor: TextAnchor) => {
      const range = rangeForAnchor(index, anchor);
      anchors[id] =
        range === undefined ? undefined : relative(anchorRect(range), origin);
      if (range === undefined) return;
      ranges.current.set(id, range);
      (id === store.activeId || id === DRAFT ? active : highlighted).push(
        range,
      );
    };
    for (const comment of comments) place(comment.id, comment.anchor);
    if (draft !== undefined) place(DRAFT, draft);
    paintHighlight("diffmap-comment", highlighted);
    paintHighlight("diffmap-comment-active", active);
    const next: Layout = {
      width: origin.width,
      contentLeft: contentRect.left - origin.left,
      contentRight: contentRect.right - origin.left,
      anchors,
    };
    setLayout((current) =>
      JSON.stringify(current) === JSON.stringify(next) ? current : next,
    );
  });

  // Measure again whenever the comments change; measure reads them itself.
  useLayoutEffect(() => {
    measure();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- These are the triggers, not inputs.
  }, [store.comments, store.draft, store.activeId]);

  // Fonts, diagrams, and fetched excerpts move the text after it first renders.
  useEffect(() => {
    const content = props.contentRef.current;
    const layerElement = layerRef.current;
    if (content === null || layerElement === null) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measure());
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(content);
    resize.observe(layerElement);
    const mutation = new MutationObserver(schedule);
    mutation.observe(content, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      paintHighlight("diffmap-comment", []);
      paintHighlight("diffmap-comment-active", []);
    };
  }, [props.contentRef]);

  // The Comment button follows a finished selection of page text.
  useEffect(() => {
    let pointerDown = false;
    const update = () => {
      const content = props.contentRef.current;
      const layerElement = layerRef.current;
      const current = document.getSelection();
      if (
        pointerDown ||
        content === null ||
        layerElement === null ||
        current === null ||
        current.rangeCount === 0 ||
        current.isCollapsed
      ) {
        setSelection(undefined);
        return;
      }
      const range = current.getRangeAt(0);
      const rects = [...range.getClientRects()].filter(
        (rect) => rect.width > 0,
      );
      if (
        !content.contains(range.commonAncestorContainer) ||
        range.toString().trim() === "" ||
        rects.length === 0
      ) {
        setSelection(undefined);
        return;
      }
      const origin = layerElement.getBoundingClientRect();
      const first = relative(rects[0]!, origin);
      const last = relative(rects.at(-1)!, origin);
      setSelection({
        range: range.cloneRange(),
        display: current.toString(),
        box: {
          top: first.top,
          left: first.left,
          bottom: last.bottom,
          right: last.right,
        },
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (closest(event.target, "[data-comment-add]")) return;
      pointerDown = true;
      setSelection(undefined);
    };
    const onPointerUp = () => {
      if (!pointerDown) return;
      pointerDown = false;
      // The selection settles after the pointer is released.
      setTimeout(update);
    };
    document.addEventListener("selectionchange", update);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [props.contentRef]);

  // Clicking highlighted text brings its comment forward; clicking elsewhere lets go.
  const onDocumentClick = useEffectEvent((event: MouseEvent) => {
    if (closest(event.target, "[data-comment-card], [data-comment-add]"))
      return;
    if (document.getSelection()?.isCollapsed === false) return;
    const point = caretPoint(event.clientX, event.clientY);
    const hit =
      point === undefined
        ? undefined
        : [...ranges.current].find(
            ([id, range]) =>
              id !== DRAFT && pointInRange(range, point.node, point.offset),
          )?.[0];
    store.setActiveId(hit);
  });
  useEffect(() => {
    const listener = (event: MouseEvent) => onDocumentClick(event);
    document.addEventListener("click", listener);
    return () => document.removeEventListener("click", listener);
  }, []);

  const startComment = () => {
    const content = props.contentRef.current;
    if (selection === undefined || content === null) return;
    const anchor = anchorFromRange(content, selection.range, selection.display);
    if (anchor === undefined) return;
    store.startDraft(anchor);
    document.getSelection()?.removeAllRanges();
    setSelection(undefined);
  };

  // A card waits for its text to be measured, so it never renders at the top and slides down.
  const entries = [
    ...comments.map((comment) => ({ id: comment.id, comment })),
    ...(draft === undefined ? [] : [{ id: DRAFT, comment: undefined }]),
  ].filter((entry) => layout !== undefined && entry.id in layout.anchors);
  const marginWidth =
    layout === undefined
      ? 0
      : layout.width - layout.contentRight - MARGIN_GAP - EDGE_GAP;
  const wide = marginWidth >= CARD_MIN;
  const pivot = draft === undefined ? store.activeId : DRAFT;
  const placed: { id: string; top: number; left: number; width: number }[] = [];
  if (layout !== undefined && wide) {
    const tops = stackCards(
      entries.map((entry) => ({
        id: entry.id,
        anchorTop: layout.anchors[entry.id]?.top ?? 0,
        anchorLeft: layout.anchors[entry.id]?.left ?? 0,
        height: heights[entry.id] ?? 80,
      })),
      pivot,
    );
    for (const entry of entries) {
      placed.push({
        id: entry.id,
        top: tops[entry.id]!,
        left: layout.contentRight + MARGIN_GAP,
        width: Math.min(CARD_MAX, marginWidth),
      });
    }
  } else if (layout !== undefined && pivot !== undefined) {
    const anchor = layout.anchors[pivot];
    const width = Math.min(
      NARROW_CARD_MAX,
      layout.contentRight - layout.contentLeft,
    );
    if (entries.some((entry) => entry.id === pivot)) {
      placed.push({
        id: pivot,
        top: anchor === undefined ? 0 : anchor.bottom + STACK_GAP,
        left: clamp(
          anchor?.left ?? layout.contentLeft,
          layout.contentLeft,
          layout.contentRight - width,
        ),
        width,
      });
    }
  }

  return (
    <div ref={layerRef} className={layer} aria-label="Comments">
      {placed.map((position) => {
        const comment = entries.find(
          (entry) => entry.id === position.id,
        )?.comment;
        return (
          <div
            key={position.id}
            className={slot}
            data-comment-id={position.id}
            data-floating={!wide}
            ref={(element) => {
              if (element === null) return;
              cardObserver.observe(element);
              return () => cardObserver.unobserve(element);
            }}
            style={{
              transform: `translateY(${String(position.top)}px)`,
              left: position.left,
              width: position.width,
            }}
          >
            <CommentCard
              comment={comment}
              detached={layout?.anchors[position.id] === undefined}
            />
          </div>
        );
      })}
      {selection !== undefined &&
        draft === undefined &&
        layout !== undefined && (
          <button
            type="button"
            className={addButton}
            data-comment-add=""
            style={
              wide
                ? {
                    top: selection.box.top,
                    left: layout.contentRight + MARGIN_GAP,
                  }
                : {
                    top: selection.box.bottom + STACK_GAP,
                    left: clamp(
                      selection.box.left,
                      layout.contentLeft,
                      layout.contentRight - 110,
                    ),
                  }
            }
            // Keep the selection; the click reads it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={startComment}
          >
            <Message size="sm" />
            <span className={addLabel}>Comment</span>
          </button>
        )}
    </div>
  );
}

/** Highlights for comment ranges; add to the page content's styles. */
export const commentHighlightStyle = style({
  "& ::highlight(diffmap-comment), &::highlight(diffmap-comment)": {
    backgroundColor: colors.amberAlpha[5],
  },
  "& ::highlight(diffmap-comment-active), &::highlight(diffmap-comment-active)":
    {
      backgroundColor: colors.amberAlpha[8],
    },
});

/**
 * Card tops in the margin: each next to its text, pushed down past the card
 * above it. The pivot card, the draft or the active one, sits exactly next to
 * its text, and the cards above it move up instead.
 */
function stackCards(
  cards: {
    id: string;
    anchorTop: number;
    anchorLeft: number;
    height: number;
  }[],
  pivotId: string | undefined,
): Record<string, number> {
  // Text order: by line, then left to right within a line.
  const sorted = cards.toSorted(
    (a, b) =>
      Math.round(a.anchorTop) - Math.round(b.anchorTop) ||
      a.anchorLeft - b.anchorLeft,
  );
  const pivot = Math.max(
    0,
    sorted.findIndex((card) => card.id === pivotId),
  );
  const tops: Record<string, number> = {};
  for (let index = pivot; index < sorted.length; index++) {
    const card = sorted[index]!;
    const above = sorted[index - 1];
    tops[card.id] =
      index === pivot || above === undefined
        ? card.anchorTop
        : Math.max(card.anchorTop, tops[above.id]! + above.height + STACK_GAP);
  }
  for (let index = pivot - 1; index >= 0; index--) {
    const card = sorted[index]!;
    const below = sorted[index + 1]!;
    tops[card.id] = Math.min(
      card.anchorTop,
      tops[below.id]! - card.height - STACK_GAP,
    );
  }
  return tops;
}

function paintHighlight(name: string, ranges: Range[]) {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  if (ranges.length === 0) CSS.highlights.delete(name);
  else CSS.highlights.set(name, new Highlight(...ranges));
}

function relative(rect: DOMRect, origin: DOMRect): Box {
  return {
    top: rect.top - origin.top,
    bottom: rect.bottom - origin.top,
    left: rect.left - origin.left,
    right: rect.right - origin.left,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function closest(target: EventTarget | null, selector: string) {
  return target instanceof Element && target.closest(selector) !== null;
}

function caretPoint(x: number, y: number) {
  if ("caretPositionFromPoint" in document) {
    const position = document.caretPositionFromPoint(x, y);
    if (position === null) return undefined;
    return { node: position.offsetNode, offset: position.offset };
  }
  // Safari before 18.4.
  const range = (document as Document).caretRangeFromPoint(x, y);
  if (range === null) return undefined;
  return { node: range.startContainer, offset: range.startOffset };
}

function pointInRange(range: Range, node: Node, offset: number) {
  try {
    return range.isPointInRange(node, offset);
  } catch {
    return false;
  }
}

const styles = {
  // Spans the whole prose row over the text; only its cards take the pointer.
  layer: style({
    gridColumn: "1 / -1",
    gridRow: "1",
    position: "relative",
    pointerEvents: "none",
    minWidth: 0,
  }),
  slot: style({
    position: "absolute",
    top: 0,
    pointerEvents: "auto",
    transition: "transform 120ms ease-out",
    "&[data-floating='true']": { zIndex: 2 },
    "&[data-floating='true'] > [data-comment-card]": {
      boxShadow: shadowVars.strong,
    },
  }),
  add: style({
    position: "absolute",
    pointerEvents: "auto",
    zIndex: 2,
  }),
};
