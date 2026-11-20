import { Fragment, type ReactNode } from "react";
import { colors, monoFontFamily, radius, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import type { StateValue, Table, TableState, TextState } from "../services.js";
import { Described } from "./ServiceStage.tsx";

type Values = {
  today: Map<string, StateValue>;
  proposed: Map<string, StateValue>;
};

/**
 * A text or table state under a service's key/value rows. In a diff whose
 * sides differ, it compares Today with Proposed; otherwise it shows what the
 * current step changed.
 */
export function StateBlock(props: {
  service: string;
  entry: TextState | TableState;
  values: Values;
  previous: Values | undefined;
  changed: boolean;
}) {
  const { entry } = props;
  const blockClass = useStyles(styles.block);
  const keyClass = useStyles(styles.key);
  const id = `${props.service}.${entry.key}`;
  // A block added or removed in a diff shows only its own side.
  const side = entry.sign === "-" ? "today" : "proposed";
  const today = props.values.today.get(entry.key);
  const proposed = props.values.proposed.get(entry.key);
  const compare =
    entry.sign === " " && today !== undefined && proposed !== undefined
      ? !sameValue(today, proposed)
      : false;
  return (
    <div
      className={blockClass}
      data-change={entry.sign}
      data-state-row={id}
      data-state-kind={entry.kind}
    >
      <Described description={entry.description}>
        <div
          className={keyClass}
          tabIndex={entry.description === undefined ? undefined : 0}
          data-described={entry.description !== undefined}
        >
          {entry.key}
        </div>
      </Described>
      {entry.kind === "text" ? (
        compare ? (
          <>
            <TextValue source={today as string} tone="removed" />
            <TextValue source={proposed as string} tone="added" />
          </>
        ) : (
          <TextValue
            source={props.values[side].get(entry.key) as string}
            tone={
              props.changed
                ? "changed"
                : entry.sign === "+"
                  ? "added"
                  : entry.sign === "-"
                    ? "removed"
                    : undefined
            }
          />
        )
      ) : (
        <TableValue
          id={id}
          // SAFETY: a table entry always replays to a Table.
          rows={
            compare
              ? mergeRows(proposed as Table, today as Table, "compare")
              : mergeRows(
                  props.values[side].get(entry.key) as Table,
                  props.changed
                    ? (props.previous?.[side].get(entry.key) as Table)
                    : undefined,
                  "step",
                )
          }
          columns={entry.columns}
          mode={compare ? "compare" : "step"}
          whole={
            entry.sign === "+"
              ? "added"
              : entry.sign === "-"
                ? "removed"
                : undefined
          }
        />
      )}
    </div>
  );
}

function sameValue(a: StateValue, b: StateValue) {
  return typeof a === "string" || typeof b === "string"
    ? a === b
    : JSON.stringify(a.rows) === JSON.stringify(b.rows);
}

/** A row as shown: its cells, and the other version's cells when they differ. */
export type ShownRow = {
  cells: string[];
  /** Per cell, the old or Today value when it differs from `cells`. */
  was: (string | undefined)[];
  /** `added`/`removed` compare Proposed with Today; `new`/`gone` the step before. */
  tone: "added" | "removed" | "new" | "gone" | undefined;
};

/**
 * Rows of `current`, with rows only `other` has slotted in where they sat
 * there. In `compare`, `other` is Today; in `step`, it is the step before.
 */
export function mergeRows(
  current: Table,
  other: Table | undefined,
  mode: "compare" | "step",
): ShownRow[] {
  if (other === undefined)
    return current.rows.map((cells) => ({
      cells,
      was: [],
      tone: undefined,
    }));
  const before = new Map(other.rows.map((cells) => [cells[0], cells]));
  const shown: ShownRow[] = current.rows.map((cells) => {
    const old = before.get(cells[0]);
    if (old === undefined)
      return { cells, was: [], tone: mode === "compare" ? "added" : "new" };
    return {
      cells,
      was: cells.map((cell, index) =>
        old[index] === cell ? undefined : old[index],
      ),
      tone: undefined,
    };
  });
  let insertAt = 0;
  for (const cells of other.rows) {
    const index = shown.findIndex((row) => row.cells[0] === cells[0]);
    if (index !== -1) {
      insertAt = index + 1;
      continue;
    }
    shown.splice(insertAt, 0, {
      cells,
      was: [],
      tone: mode === "compare" ? "removed" : "gone",
    });
    insertAt++;
  }
  return shown;
}

function TableValue(props: {
  id: string;
  columns: string[];
  rows: ShownRow[];
  mode: "compare" | "step";
  whole: "added" | "removed" | undefined;
}) {
  const tableClass = useStyles(styles.table);
  return (
    <table
      className={tableClass}
      data-mode={props.mode}
      data-whole={props.whole}
    >
      <thead>
        <tr>
          {props.columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row, index) => (
          <tr
            key={`${row.cells[0]}:${index}`}
            data-tone={row.tone}
            data-state-row={`${props.id}[${row.cells[0]}]`}
          >
            {row.cells.map((cell, column) => {
              const was = row.was[column];
              return (
                <td key={column} data-changed={was !== undefined}>
                  {was !== undefined && (
                    <>
                      <s data-was>{was}</s>{" "}
                    </>
                  )}
                  <span>{cell}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TextValue(props: {
  source: string;
  tone: "added" | "removed" | "changed" | undefined;
}) {
  const textClass = useStyles(styles.text);
  return (
    <div className={textClass} data-tone={props.tone} data-text>
      <StateMarkdown source={props.source} />
    </div>
  );
}

/**
 * The Markdown a text state supports: paragraphs, bulleted and numbered
 * lists, `[ ]` and `[x]` checklists, **bold**, *italic*, and `code`.
 */
export function StateMarkdown(props: { source: string }) {
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | undefined;
  const flush = () => {
    if (paragraph.length > 0)
      blocks.push(<p key={blocks.length}>{inline(paragraph.join(" "))}</p>);
    if (list !== undefined) {
      const items = list.items.map((item, index) => {
        const task = /^\[([ xX])\]\s+(.*)$/.exec(item);
        return (
          <li key={index} data-task={task !== null}>
            {task !== null && (
              <span aria-hidden="true">{task[1] === " " ? "☐ " : "☑ "}</span>
            )}
            {inline(task?.[2] ?? item)}
          </li>
        );
      });
      blocks.push(
        list.ordered ? (
          <ol key={blocks.length}>{items}</ol>
        ) : (
          <ul key={blocks.length}>{items}</ul>
        ),
      );
    }
    paragraph = [];
    list = undefined;
  };
  for (const line of props.source.split("\n")) {
    const item = /^\s*(?:([-*+])|\d+[.)])\s+(.*)$/.exec(line);
    if (item !== null) {
      const ordered = item[1] === undefined;
      if (paragraph.length > 0 || list?.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push(item[2]!);
    } else if (line.trim() === "") flush();
    else {
      if (list !== undefined) flush();
      paragraph.push(line.trim());
    }
  }
  flush();
  return <>{blocks}</>;
}

function inline(source: string): ReactNode {
  return source
    .split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/)
    .map((part, index) => {
      if (part.startsWith("`") && part.length > 1)
        return <code key={index}>{part.slice(1, -1)}</code>;
      if (part.startsWith("**") && part.length > 3)
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (/^[*_].+[*_]$/.test(part))
        return <em key={index}>{part.slice(1, -1)}</em>;
      return <Fragment key={index}>{part}</Fragment>;
    });
}

/** The dotted underline on a service name or state key that has a description. */
export const described = {
  "&[data-described='true']": {
    textDecorationLine: "underline",
    textDecorationStyle: "dotted" as const,
    textDecorationColor: colors.gray[8],
    textUnderlineOffset: "3px",
  },
};

const styles = {
  // A soft panel that bleeds into the card's padding.
  block: style(radius.sm, {
    marginInline: `calc(${spacing.value(4)} - ${spacing.value(3)})`,
    marginBottom: spacing.value(3),
    // Key/value rows are inset by their padding; match it so columns line up.
    paddingInline: `calc(${spacing.value(3)} + ${spacing.value(2)})`,
    paddingBlock: spacing.value(2),
    minWidth: 0,
    backgroundColor: colors.gray[2],
    "& > [data-text] + [data-text]": { marginTop: spacing.value(1) },
  }),
  // A title in the card's description style, like the service's label.
  key: style(text({ size: "xs" }), {
    width: "fit-content",
    marginBottom: spacing.value(1),
    color: colors.gray[11],
    ...described,
    "&:focus-visible": { outline: `2px solid ${colors.blueAlpha[8]}` },
  }),
  // Prose, so it reads as text rather than a value; wraps at about 36ch.
  text: style(text({ size: "xs" }), radius.xs, {
    maxWidth: "36ch",
    paddingInline: spacing.value(2),
    overflowWrap: "anywhere",
    // The attribute outranks the page's prose sizes for p and li.
    "&[data-text] :is(p, ul, ol, li)": {
      margin: 0,
      fontSize: "inherit",
      lineHeight: "inherit",
      color: "inherit",
    },
    "& > * + *": { marginTop: spacing.value(1) },
    "&[data-text] ul": { paddingLeft: "1.25em", listStyle: "disc" },
    "&[data-text] ol": { paddingLeft: "1.25em", listStyle: "decimal" },
    "&[data-text] li[data-task='true']": {
      listStyle: "none",
      marginLeft: "-1.25em",
    },
    "& code": { fontFamily: monoFontFamily },
    "&[data-tone='changed']": {
      backgroundColor: colors.accentAlpha[3],
      color: colors.accent[11],
    },
    "&[data-tone='added']": {
      backgroundColor: colors.greenAlpha[3],
      boxShadow: `inset 2px 0 ${colors.green[9]}`,
    },
    "&[data-tone='removed']": {
      backgroundColor: colors.redAlpha[3],
      boxShadow: `inset 2px 0 ${colors.red[9]}`,
      color: colors.red[11],
      textDecorationLine: "line-through",
    },
  }),
  // Inset: faint headings and hairlines between rows. The first column is as
  // wide as the card's state keys and the gap matches theirs, so every column
  // lines up with the key/value rows above.
  table: style(text({ size: "xs", monospace: true }), {
    borderCollapse: "collapse",
    "& th": {
      fontWeight: "inherit",
      textAlign: "start",
      color: colors.gray[10],
    },
    "& th, & td": {
      padding: 0,
      paddingRight: spacing.value(4),
      verticalAlign: "top",
      maxWidth: "24ch",
      overflowWrap: "anywhere",
    },
    "& td": { borderTop: `1px solid ${colors.gray[5]}`, paddingBlock: 1 },
    "& :is(th, td):last-child": { paddingRight: 0 },
    "& :is(th, td):first-child": {
      position: "relative",
      width: `calc(var(--key-width) + ${spacing.value(4)})`,
    },
    "& td:first-child": { color: colors.gray[11] },
    // In a diff, a + or − in the panel's padding marks a row only one side has.
    "& tr[data-tone] > td:first-child::before": {
      position: "absolute",
      right: "100%",
      width: spacing.value(3),
      textAlign: "center",
      textDecorationLine: "none",
    },
    "& tr[data-tone='added'] > td:first-child::before": { content: '"+"' },
    "& tr[data-tone='removed'] > td:first-child::before": { content: '"−"' },
    // A step: the new value in bold teal; ← shows the old one.
    "&[data-mode='step'] [data-was]": { display: "none" },
    "&[data-mode='step'] td[data-changed='true'] > span": {
      color: colors.accent[11],
      fontWeight: 600,
    },
    "& tr[data-tone='new'] > td": { color: colors.accent[11] },
    "& tr[data-tone='gone'] > td": { color: colors.gray[10] },
    // A diff: Today's value struck in red beside Proposed's in green.
    "&[data-mode='compare'] [data-was]": { color: colors.red[11] },
    "&[data-mode='compare'] td[data-changed='true'] > span": {
      color: colors.green[11],
    },
    "& tr[data-tone='added'] > td, &[data-whole='added'] tbody td": {
      color: colors.green[11],
    },
    "& tr[data-tone='removed'] > td, &[data-whole='removed'] tbody td": {
      color: colors.red[11],
    },
    // On the text, so the row's − marker isn't struck through too.
    "& tr:is([data-tone='gone'], [data-tone='removed']) > td > span, &[data-whole='removed'] tbody td > span":
      { textDecorationLine: "line-through" },
  }),
};
