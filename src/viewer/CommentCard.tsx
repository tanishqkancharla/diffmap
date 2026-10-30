import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  backgroundColor,
  Button,
  flex,
  motion,
  Pencil,
  radius,
  shadow,
  shadowVars,
  spacing,
  Text,
  text,
  textFieldStyles,
  Trash,
} from "maui";
import { style, useStyles } from "purse-styles";
import { useComments, type ReviewComment } from "./comments.ts";

/** A saved comment, or the draft being written when `comment` is undefined. */
export function CommentCard(props: {
  comment: ReviewComment | undefined;
  /** The highlighted text is no longer on the page. */
  detached?: boolean;
}) {
  const store = useComments();
  const [editing, setEditing] = useState(false);
  const card = useStyles(styles.card);
  const body = useStyles(styles.body);
  const actions = useStyles(styles.actions);
  const comment = props.comment;
  const active = comment === undefined || store.activeId === comment.id;
  const anchor = comment === undefined ? store.draft : comment.anchor;
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Focus inside the card activates it too; the click only brings it forward.
    <div
      className={card}
      data-comment-card=""
      data-active={active}
      onClick={() => {
        if (comment !== undefined) store.setActiveId(comment.id);
      }}
      onFocus={() => {
        if (comment !== undefined) store.setActiveId(comment.id);
      }}
    >
      {props.detached === true && comment?.anchor.kind === "text" && (
        <Text size="xs" color="lowContrast">
          Text not found: “{comment.anchor.display.trim()}”
        </Text>
      )}
      {/* The card sits under the last line, so a range names its first line too. */}
      {anchor?.kind === "lines" && anchor.start !== anchor.end && (
        <Text size="xs" color="lowContrast">
          Lines {anchor.start}–{anchor.end}
        </Text>
      )}
      {comment === undefined ? (
        <Composer
          initial=""
          submitLabel="Comment"
          onSubmit={store.saveDraft}
          onCancel={store.cancelDraft}
        />
      ) : editing ? (
        <Composer
          initial={comment.body}
          submitLabel="Save"
          onSubmit={(next) => {
            store.update(comment.id, next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className={body}>{comment.body}</div>
          <div className={actions} data-actions="">
            <Button
              variant="quiet"
              size="sm"
              aria-label="Edit comment"
              onPress={() => setEditing(true)}
            >
              <Pencil size="sm" />
            </Button>
            <Button
              variant="quiet"
              size="sm"
              aria-label="Delete comment"
              onPress={() => store.remove(comment.id)}
            >
              <Trash size="sm" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Composer(props: {
  initial: string;
  submitLabel: string;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(props.initial);
  const textarea = useRef<HTMLTextAreaElement>(null);
  // Pierre mounts line comments before it attaches them, so autoFocus would miss.
  useEffect(() => {
    const frame = requestAnimationFrame(() => textarea.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const input = useStyles(textFieldStyles.input({}), styles.textarea);
  const buttons = useStyles(styles.buttons);
  const blank = value.trim() === "";
  const submit = () => {
    if (!blank) props.onSubmit(value.trim());
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      props.onCancel();
    }
  };
  return (
    <>
      <textarea
        className={input}
        aria-label="Comment"
        placeholder="Add a comment…"
        ref={textarea}
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className={buttons}>
        <Button variant="quiet" size="sm" onPress={props.onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          variantColor="blue"
          size="sm"
          isDisabled={blank}
          onPress={submit}
        >
          {props.submitLabel}
        </Button>
      </div>
    </>
  );
}

const styles = {
  card: style(
    flex({ direction: "column", gap: 3 }),
    radius.md,
    shadow.subtle,
    spacing.padding({ x: 4, y: 4 }),
    motion.standard("box-shadow"),
    {
      position: "relative",
      minWidth: 0,
      backgroundColor: backgroundColor.element,
      cursor: "default",
      "&[data-active='true']": { boxShadow: shadowVars.medium },
      "&:hover > [data-actions], &:focus-within > [data-actions], &[data-active='true'] > [data-actions]":
        { opacity: 1 },
    },
  ),
  body: style(text({ size: "sm", color: "highContrast" }), {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    paddingRight: "52px",
  }),
  // Hidden until the card is hovered, focused, or active. Touch screens have no hover.
  actions: style(flex({ direction: "row", gap: 1 }), {
    position: "absolute",
    top: "4px",
    right: "4px",
    opacity: 0,
    "@media (hover: none)": { opacity: 1 },
  }),
  textarea: style({
    display: "block",
    height: "auto",
    minHeight: "60px",
    resize: "vertical",
    fontFamily: "inherit",
  }),
  buttons: style(flex({ direction: "row", justifyContent: "end", gap: 2 }), {}),
};
