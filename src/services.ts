import { parseAnnotation, type SourceAnnotation } from "./annotations.js";

/**
 * A `services` fence: services that hold state, nest sub-services, and send
 * each other events. Steps replay the events in order. A step's events travel
 * one after another; its state updates land when the last one arrives.
 */
export type ServiceDiagram = {
  services: Service[];
  /** From `start "caption"`: what the declared state shows, before step 1. */
  start: { caption: string; description: string | undefined } | undefined;
  steps: ServiceStep[];
  /** From ```services diff: items carry `+` or `-` signs. */
  diff: boolean;
};

/**
 * In a `services diff`, `-` marks an item that exists only Today and `+` one
 * that exists only in the Proposed version. Items inherit the sign of the
 * service or step they sit in.
 */
export type Sign = "+" | "-" | " ";

export type Side = "today" | "proposed";

export type Service = {
  name: string;
  label: string | undefined;
  description: string | undefined;
  state: ServiceState[];
  children: Service[];
  annotation: SourceAnnotation | undefined;
  sign: Sign;
};

/** A state entry: a short value, Markdown text, or a table of rows. */
export type ServiceState = ValueState | TextState | TableState;

type StateCommon = {
  key: string;
  description: string | undefined;
  sign: Sign;
};

export type ValueState = StateCommon & {
  kind: "value";
  /** The Proposed initial value. */
  value: string;
  /** Set when a `-` and a `+` line declare the key with different values. */
  todayValue: string | undefined;
};

/** From `text key` and the `|` lines under it. */
export type TextState = StateCommon & { kind: "text"; lines: StateLine[] };

/** From `table key`: a header line, then rows. Each row's first cell names it. */
export type TableState = StateCommon & {
  kind: "table";
  columns: string[];
  rows: TableRow[];
};

/** One `|` line of Markdown; in a diff, Today skips `+` lines and Proposed `-` lines. */
export type StateLine = { text: string; sign: Sign };

export type TableRow = { cells: string[]; sign: Sign };

/** A table's value at one step on one side. */
export type Table = { columns: string[]; rows: string[][] };

/** What a state key holds at one step: a value, Markdown text, or a table. */
export type StateValue = string | Table;

export type ServiceStep = {
  /** What happens in this step, in a sentence. */
  caption: string;
  description: string | undefined;
  events: ServiceEvent[];
  updates: ServiceUpdate[];
  /** Notes on whole services, from a bare service name with a `>` line under it. */
  notes: ServiceNote[];
  sign: Sign;
};

/** Shown beside a service while its step is current, such as what the service is doing. */
export type ServiceNote = {
  service: string;
  text: string;
  sign: Sign;
};

export type ServiceEvent = {
  from: string;
  to: string;
  label: string;
  /** Shown beside the event's label while its step is current. */
  note: string | undefined;
  annotation: SourceAnnotation | undefined;
  sign: Sign;
};

export type ServiceUpdate = {
  service: string;
  key: string;
  change: StateChange;
  /** Shown beside the changed state while its step is current. */
  note: string | undefined;
  sign: Sign;
};

/**
 * `Service.key = value` sets a value; on a text key it replaces the text,
 * with `|` lines under it for more than one line. On a table key,
 * `[row].column = value` sets a cell, `+= | … |` adds a row, and `-= row`
 * removes one.
 */
export type StateChange =
  | { kind: "set"; value: string }
  | { kind: "text"; lines: StateLine[] }
  | { kind: "cell"; row: string; column: string; value: string }
  | { kind: "addRow"; cells: string[] }
  | { kind: "removeRow"; row: string };

export type ServicesParse =
  | { ok: true; diagram: ServiceDiagram }
  | { ok: false; line: number; reason: string };

const name = String.raw`[A-Za-z_]\w*`;
const serviceLine = new RegExp(
  String.raw`^service\s+(${name})(?:\s+"([^"]*)")?\s*$`,
);
const stateLine = new RegExp(String.raw`^state\s+(${name})\s*=\s*(.+)$`);
const stepLine = /^step\b(?:\s+"([^"]*)")?\s*$/;
const startLine = /^start\b(?:\s+"([^"]*)")?\s*$/;
const eventLine = new RegExp(
  String.raw`^(${name})\s*->\s*(${name})(?:\s*:\s*(.*))?$`,
);
const textLine = new RegExp(String.raw`^text\s+(${name})\s*$`);
const tableLine = new RegExp(String.raw`^table\s+(${name})\s*$`);
const updateLine = new RegExp(
  String.raw`^(${name})\.(${name})(?:\[([^\]]+)\]\.(${name}))?\s*(=|\+=|-=)\s*(.*)$`,
);

/** The sides of a diff a line with this sign belongs to. */
function sidesOf(sign: Sign): Side[] {
  return sign === "+"
    ? ["proposed"]
    : sign === "-"
      ? ["today"]
      : ["today", "proposed"];
}

/** An item takes the sign of the service, step, or state it sits in. */
function signInside(
  outer: Sign,
  own: Sign,
  kind: string,
): { sign: Sign } | { reason: string } {
  if (outer === " " || own === " " || own === outer)
    return { sign: outer === " " ? own : outer };
  return {
    reason: `A ${own} line can't sit inside a ${outer === "-" ? "removed" : "added"} ${kind}.`,
  };
}

/** A text's `|` line without its bar and the one space after it. */
function markdownOf(line: string) {
  return line.slice(1).replace(/^ /, "");
}

/** The cells of a `| a | b |` line, or undefined for a `|---|---|` separator. */
function tableCells(line: string): string[] | undefined {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = inner.split("|").map((cell) => cell.trim());
  return cells.every((cell) => /^:?-+:?$/.test(cell)) ? undefined : cells;
}
const serviceNoteLine = new RegExp(String.raw`^(${name})$`);

/**
 * ```services
 * service API "HTTP server" [[src/api.ts]]
 *   state requests = 0
 *   service Auth
 *     state attempts = 0
 *
 * step "Check the password"
 *   API -> Auth: verify(alice) [[src/api.ts#login]]
 *   Auth.attempts = 1
 * ```
 */
export function parseServiceDiagram(
  source: string,
  diff = false,
): ServicesParse {
  const services: Service[] = [];
  const byName = new Map<string, Service>();
  const steps: ServiceStep[] = [];
  let start: ServiceDiagram["start"];
  // Open services, innermost last, with the indent of their `service` line.
  const open: { indent: number; service: Service }[] = [];
  // Where a `>` line's text goes: a description on a service, state, or
  // step, or a note on an event or update.
  let described: { indent: number; append: (text: string) => void } | undefined;
  const describe = (indent: number, item: { description?: string }) => {
    described = {
      indent,
      append: (more) => {
        item.description =
          item.description === undefined ? more : `${item.description} ${more}`;
      },
    };
  };
  const annotate = (indent: number, item: { note?: string }) => {
    described = {
      indent,
      append: (more) => {
        item.note = item.note === undefined ? more : `${item.note} ${more}`;
      },
    };
  };
  // A bare service name in a step, waiting for the `>` line that is its note.
  let pendingNote: { line: number; note: { text: string } } | undefined;
  // Where a `|` line goes: a text's Markdown, or a table's header and rows.
  // `finish` reports what is still missing once the lines end.
  let piped:
    | {
        indent: number;
        add: (cells: string, sign: Sign) => string | undefined;
        finish: () => ServicesParse | undefined;
      }
    | undefined;
  // Each table's row names on each side, as replayed so far, so updates can
  // name only rows that exist at their step.
  const liveRows = new Map<string, Record<Side, Set<string>>>();
  const noteMissing = () =>
    pendingNote !== undefined && pendingNote.note.text === ""
      ? ({
          ok: false,
          line: pendingNote.line,
          reason:
            "A service name in a step needs a > line under it with its note.",
        } satisfies ServicesParse)
      : undefined;
  const lines = source.split("\n");
  for (const [index, row] of lines.entries()) {
    const line = index + 1;
    const fail = (reason: string): ServicesParse => ({
      ok: false,
      line,
      reason,
    });
    if (row.trim().length === 0 || row.trim().startsWith("%%")) continue;
    // A diff's first column is its sign, so indentation counts from column 1.
    if (diff && !/^[+ -]/.test(row))
      return fail("Start every line of a services diff with +, -, or a space.");
    // SAFETY: the test above limits a diff row's first character to a Sign.
    const own: Sign = diff ? (row[0] as Sign) : " ";
    const raw = diff ? row.slice(1) : row;
    const text = raw.trim();
    if (text.length === 0) continue;
    const indent = raw.replace(/\t/g, "  ").search(/\S/);
    // An item takes the sign of the service or step it sits in.
    const signWithin = (
      container: { sign: Sign } | undefined,
      kind: string,
    ) => {
      const nested = signInside(container?.sign ?? " ", own, kind);
      return "sign" in nested ? nested.sign : fail(nested.reason);
    };
    if (text.startsWith(">")) {
      if (described === undefined || indent <= described.indent)
        return fail(
          "Put a > line directly below the service, state, step, event, or update it describes, indented further.",
        );
      described.append(text.slice(1).trim());
      continue;
    }
    if (text.startsWith("|")) {
      if (piped === undefined || indent <= piped.indent)
        return fail(
          "Put a | line directly below the text, table, or text update it belongs to, indented further.",
        );
      const problem = piped.add(text, own);
      if (problem !== undefined) return fail(problem);
      continue;
    }
    const unfinished = piped?.finish();
    if (unfinished !== undefined) return unfinished;
    piped = undefined;
    const missing = noteMissing();
    if (missing !== undefined) return missing;
    pendingNote = undefined;
    const { text: body, references } = parseAnnotation(text);
    const annotation =
      references.length === 0 ? undefined : { text: body.trim(), references };
    const step = steps.at(-1);

    const serviceMatch = serviceLine.exec(body.trim());
    if (serviceMatch !== null) {
      if (step !== undefined)
        return fail("Declare every service before the first step.");
      const serviceName = serviceMatch[1]!;
      if (byName.has(serviceName))
        return fail(`Service ${serviceName} is declared twice.`);
      while (open.length > 0 && open.at(-1)!.indent >= indent) open.pop();
      const sign = signWithin(open.at(-1)?.service, "service");
      if (typeof sign !== "string") return sign;
      const service: Service = {
        name: serviceName,
        label: serviceMatch[2],
        description: undefined,
        state: [],
        children: [],
        annotation:
          annotation === undefined
            ? undefined
            : { ...annotation, text: serviceName },
        sign,
      };
      (open.at(-1)?.service.children ?? services).push(service);
      byName.set(serviceName, service);
      open.push({ indent, service });
      describe(indent, service);
      continue;
    }

    const stateMatch = stateLine.exec(text);
    const textMatch = textLine.exec(text);
    const tableMatch = tableLine.exec(text);
    if (stateMatch !== null || textMatch !== null || tableMatch !== null) {
      if (step !== undefined)
        return fail(
          "Declare state under its service, before the first step. Change it in a step with Service.key = value.",
        );
      while (open.length > 0 && open.at(-1)!.indent >= indent) open.pop();
      const owner = open.at(-1)?.service;
      if (owner === undefined)
        return fail("Indent state under the service that owns it.");
      const key = (stateMatch ?? textMatch ?? tableMatch)![1]!;
      const sign = signWithin(owner, "service");
      if (typeof sign !== "string") return sign;
      const declared = owner.state.find((entry) => entry.key === key);
      if (declared !== undefined) {
        // A `-` and a `+` declaration of one key change its initial value.
        if (
          stateMatch === null ||
          declared.kind !== "value" ||
          declared.todayValue !== undefined ||
          declared.sign === " " ||
          sign === " " ||
          declared.sign === sign
        )
          return fail(`${owner.name}.${key} is declared twice.`);
        const value = stateMatch[2]!.trim();
        declared.todayValue = declared.sign === "-" ? declared.value : value;
        declared.value = declared.sign === "+" ? declared.value : value;
        declared.sign = " ";
        describe(indent, declared);
        continue;
      }
      if (stateMatch !== null) {
        const entry: ServiceState = {
          kind: "value",
          key,
          value: stateMatch[2]!.trim(),
          todayValue: undefined,
          description: undefined,
          sign,
        };
        owner.state.push(entry);
        describe(indent, entry);
        continue;
      }
      if (textMatch !== null) {
        const entry: TextState = {
          kind: "text",
          key,
          lines: [],
          description: undefined,
          sign,
        };
        owner.state.push(entry);
        describe(indent, entry);
        piped = {
          indent,
          add: (bar, barSign) => {
            const nested = signInside(entry.sign, barSign, "text");
            if ("reason" in nested) return nested.reason;
            entry.lines.push({ text: markdownOf(bar), sign: nested.sign });
            return undefined;
          },
          finish: () => undefined,
        };
        continue;
      }
      const entry: TableState = {
        kind: "table",
        key,
        columns: [],
        rows: [],
        description: undefined,
        sign,
      };
      owner.state.push(entry);
      describe(indent, entry);
      const live = { today: new Set<string>(), proposed: new Set<string>() };
      liveRows.set(`${owner.name}.${key}`, live);
      const declaredAt = line;
      piped = {
        indent,
        add: (bar, barSign) => {
          const cells = tableCells(bar);
          if (cells === undefined) return undefined;
          if (entry.columns.length === 0) {
            if (entry.sign === " " && barSign !== " ")
              return "Both versions share a table's header line; drop its sign.";
            entry.columns = cells;
            return undefined;
          }
          const nested = signInside(entry.sign, barSign, "table");
          if ("reason" in nested) return nested.reason;
          const within = nested.sign;
          if (cells.length !== entry.columns.length)
            return `This row has ${cells.length} cells, but ${owner.name}.${key} has ${entry.columns.length} columns (${entry.columns.join(", ")}).`;
          for (const side of sidesOf(within)) {
            if (live[side].has(cells[0]!))
              return `${owner.name}.${key} already has a row ${cells[0]}. The first column names each row, so it must be unique.`;
            live[side].add(cells[0]!);
          }
          entry.rows.push({ cells, sign: within });
          return undefined;
        },
        finish: () =>
          entry.columns.length > 0
            ? undefined
            : {
                ok: false,
                line: declaredAt,
                reason: `Give table ${key} a header line under it, like | id | status |.`,
              },
      };
      continue;
    }

    const startMatch = startLine.exec(text);
    if (startMatch !== null) {
      if (indent !== 0) return fail("Start the start line at column 0.");
      if (step !== undefined || start !== undefined)
        return fail("Write one start line, before the first step.");
      if (own !== " ")
        return fail("The start line describes both versions; drop its sign.");
      const caption = startMatch[1]?.trim();
      if (caption === undefined || caption === "")
        return fail(
          'Give the start a caption that says what the initial state shows, like start "Alice is signed out".',
        );
      start = { caption, description: undefined };
      describe(indent, start);
      continue;
    }

    const stepMatch = stepLine.exec(text);
    if (stepMatch !== null) {
      if (indent !== 0) return fail("Start step lines at column 0.");
      const caption = stepMatch[1]?.trim();
      if (caption === undefined || caption === "")
        return fail(
          'Give the step a caption that says what happens, like step "Auth checks the password".',
        );
      const next: ServiceStep = {
        caption,
        description: undefined,
        events: [],
        updates: [],
        notes: [],
        sign: own,
      };
      steps.push(next);
      describe(indent, next);
      continue;
    }

    if (step !== undefined && indent > 0) {
      const event = eventLine.exec(body.trim());
      if (event !== null) {
        for (const service of [event[1]!, event[2]!])
          if (!byName.has(service)) return fail(`Unknown service ${service}.`);
        const label = (event[3] ?? "").trim();
        const sign = signWithin(step, "step");
        if (typeof sign !== "string") return sign;
        const entry: ServiceEvent = {
          from: event[1]!,
          to: event[2]!,
          label,
          note: undefined,
          annotation:
            annotation === undefined
              ? undefined
              : {
                  ...annotation,
                  text: `${event[1]} → ${event[2]}${label === "" ? "" : `: ${label}`}`,
                },
          sign,
        };
        step.events.push(entry);
        annotate(indent, entry);
        continue;
      }
      const update = updateLine.exec(text);
      if (update !== null) {
        const [, service, key, rowKey, column, operator, rest] = update;
        const owner = byName.get(service!);
        if (owner === undefined) return fail(`Unknown service ${service}.`);
        const declared = owner.state.find((entry) => entry.key === key);
        if (declared === undefined)
          return fail(
            `${owner.name} has no state ${key}. Declare it with state ${key} = <initial value>, text ${key}, or table ${key}.`,
          );
        const sign = signWithin(step, "step");
        if (typeof sign !== "string") return sign;
        const target = `${owner.name}.${key}`;
        const value = rest!.trim();
        let change: StateChange;
        if (declared.kind === "table") {
          const live = liveRows.get(target)!;
          const rowName = rowKey?.trim() ?? value;
          if (rowKey !== undefined && operator === "=") {
            if (!declared.columns.includes(column!))
              return fail(
                `${target} has no column ${column}. Its columns are ${declared.columns.join(", ")}.`,
              );
            change = { kind: "cell", row: rowName, column: column!, value };
          } else if (rowKey === undefined && operator === "+=") {
            const cells = tableCells(value);
            if (!value.startsWith("|") || cells === undefined)
              return fail(
                `Add a row with ${target} += | ${declared.columns.join(" | ")} |.`,
              );
            if (cells.length !== declared.columns.length)
              return fail(
                `This row has ${cells.length} cells, but ${target} has ${declared.columns.length} columns (${declared.columns.join(", ")}).`,
              );
            change = { kind: "addRow", cells };
          } else if (
            rowKey === undefined &&
            operator === "-=" &&
            value !== ""
          ) {
            change = { kind: "removeRow", row: rowName };
          } else
            return fail(
              `Change table ${target} with ${target}[row].column = value, ${target} += | … |, or ${target} -= row.`,
            );
          const named = change.kind === "addRow" ? change.cells[0]! : rowName;
          for (const side of sidesOf(sign)) {
            const exists = live[side].has(named);
            if (change.kind === "addRow" && exists)
              return fail(`${target} already has a row ${named} at this step.`);
            if (change.kind !== "addRow" && !exists)
              return fail(`${target} has no row ${named} at this step.`);
            if (change.kind === "addRow") live[side].add(named);
            if (change.kind === "removeRow") live[side].delete(named);
          }
        } else if (rowKey !== undefined || operator !== "=") {
          return fail(
            `Only a table takes [row].column, +=, or -=. Change ${target} with ${target} = <new value>.`,
          );
        } else if (declared.kind === "text") {
          change = {
            kind: "text",
            lines: value === "" ? [] : [{ text: value, sign: " " }],
          };
        } else {
          if (value === "") return fail(`Give ${target} a new value after =.`);
          change = { kind: "set", value };
        }
        const entry: ServiceUpdate = {
          service: owner.name,
          key: key!,
          change,
          note: undefined,
          sign,
        };
        step.updates.push(entry);
        annotate(indent, entry);
        if (change.kind === "text" && change.lines.length === 0) {
          const textLines = change.lines;
          const updatedAt = line;
          piped = {
            indent,
            add: (markdown, lineSign) => {
              const nested = signInside(entry.sign, lineSign, "update");
              if ("reason" in nested) return nested.reason;
              textLines.push({ text: markdownOf(markdown), sign: nested.sign });
              return undefined;
            },
            finish: () =>
              textLines.length > 0
                ? undefined
                : {
                    ok: false,
                    line: updatedAt,
                    reason: `Put the new text after ${target} =, or in | lines under it.`,
                  },
          };
        }
        continue;
      }
      const noteTarget = serviceNoteLine.exec(text);
      if (noteTarget !== null) {
        if (!byName.has(noteTarget[1]!))
          return fail(`Unknown service ${noteTarget[1]}.`);
        const sign = signWithin(step, "step");
        if (typeof sign !== "string") return sign;
        const entry: ServiceNote = { service: noteTarget[1]!, text: "", sign };
        step.notes.push(entry);
        pendingNote = { line, note: entry };
        described = {
          indent,
          append: (more) => {
            entry.text = entry.text === "" ? more : `${entry.text} ${more}`;
          },
        };
        continue;
      }
      return fail(
        `Expected an event (From -> To: label), a state update (Service.key = value), or a service name with a > note under it, got "${text}".`,
      );
    }

    return fail(
      `Expected service <Name>, state <key> = <value>, start "<caption>", or step "<caption>", got "${text}".`,
    );
  }
  const unfinished = piped?.finish();
  if (unfinished !== undefined) return unfinished;
  const missing = noteMissing();
  if (missing !== undefined) return missing;
  if (services.length === 0)
    return { ok: false, line: 1, reason: "Declare at least one service." };
  return { ok: true, diagram: { services, start, steps, diff } };
}

/** Every service in declaration order, with its parent. */
export function flattenServices(
  services: Service[],
  parent?: Service,
): { service: Service; parent: Service | undefined }[] {
  return services.flatMap((service) => [
    { service, parent },
    ...flattenServices(service.children, service),
  ]);
}

/**
 * State after the first `step` steps; step 0 is the declared state. In a
 * diff, Today skips `+` items and Proposed skips `-` items.
 */
export function serviceStateAt(
  diagram: ServiceDiagram,
  step: number,
  side: Side = "proposed",
): Map<string, Map<string, StateValue>> {
  const skip: Sign = side === "today" ? "+" : "-";
  const markdown = (lines: StateLine[]) =>
    lines
      .filter((line) => line.sign !== skip)
      .map((line) => line.text)
      .join("\n");
  const initial = (entry: ServiceState): StateValue => {
    if (entry.kind === "text") return markdown(entry.lines);
    if (entry.kind === "table")
      return {
        columns: entry.columns,
        rows: entry.rows
          .filter((row) => row.sign !== skip)
          .map((row) => row.cells),
      };
    return side === "today" ? (entry.todayValue ?? entry.value) : entry.value;
  };
  const state = new Map(
    flattenServices(diagram.services).map(({ service }) => [
      service.name,
      new Map(
        service.state
          .filter((entry) => entry.sign !== skip)
          .map((entry) => [entry.key, initial(entry)]),
      ),
    ]),
  );
  for (const { updates } of diagram.steps.slice(0, step))
    for (const { service, key, change, sign } of updates) {
      if (sign === skip) continue;
      const values = state.get(service)!;
      const before = values.get(key)!;
      if (change.kind === "set") values.set(key, change.value);
      else if (change.kind === "text") values.set(key, markdown(change.lines));
      else {
        // SAFETY: the parser accepts row changes only on table keys.
        const table = before as Table;
        const at = table.columns.indexOf(
          change.kind === "cell" ? change.column : "",
        );
        values.set(key, {
          columns: table.columns,
          rows:
            change.kind === "addRow"
              ? [...table.rows, change.cells]
              : change.kind === "removeRow"
                ? table.rows.filter((row) => row[0] !== change.row)
                : table.rows.map((row) =>
                    row[0] === change.row ? row.with(at, change.value) : row,
                  ),
        });
      }
    }
  return state;
}

export function serviceAnnotations(diagram: ServiceDiagram) {
  return [
    ...flattenServices(diagram.services).flatMap(({ service }) =>
      service.annotation === undefined ? [] : [service.annotation],
    ),
    ...diagram.steps.flatMap((step) =>
      step.events.flatMap((event) =>
        event.annotation === undefined ? [] : [event.annotation],
      ),
    ),
  ];
}
