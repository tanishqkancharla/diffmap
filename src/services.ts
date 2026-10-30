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

export type ServiceState = {
  key: string;
  /** The Proposed initial value. */
  value: string;
  /** Set when a `-` and a `+` line declare the key with different values. */
  todayValue: string | undefined;
  description: string | undefined;
  sign: Sign;
};

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
  value: string;
  /** Shown beside the changed state while its step is current. */
  note: string | undefined;
  sign: Sign;
};

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
const updateLine = new RegExp(String.raw`^(${name})\.(${name})\s*=\s*(.+)$`);
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
      const outer = container?.sign ?? " ";
      if (outer === " " || own === " " || own === outer)
        return outer === " " ? own : outer;
      return fail(
        `A ${own} line can't sit inside a ${outer === "-" ? "removed" : "added"} ${kind}.`,
      );
    };
    if (text.startsWith(">")) {
      if (described === undefined || indent <= described.indent)
        return fail(
          "Put a > line directly below the service, state, step, event, or update it describes, indented further.",
        );
      described.append(text.slice(1).trim());
      continue;
    }
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
    if (stateMatch !== null) {
      if (step !== undefined)
        return fail(
          "Declare state under its service, before the first step. Change it in a step with Service.key = value.",
        );
      while (open.length > 0 && open.at(-1)!.indent >= indent) open.pop();
      const owner = open.at(-1)?.service;
      if (owner === undefined)
        return fail("Indent state under the service that owns it.");
      const key = stateMatch[1]!;
      const value = stateMatch[2]!.trim();
      const sign = signWithin(owner, "service");
      if (typeof sign !== "string") return sign;
      const declared = owner.state.find((entry) => entry.key === key);
      if (declared !== undefined) {
        // A `-` and a `+` declaration of one key change its initial value.
        if (
          declared.todayValue !== undefined ||
          declared.sign === " " ||
          sign === " " ||
          declared.sign === sign
        )
          return fail(`${owner.name}.${key} is declared twice.`);
        declared.todayValue = declared.sign === "-" ? declared.value : value;
        declared.value = declared.sign === "+" ? declared.value : value;
        declared.sign = " ";
        describe(indent, declared);
        continue;
      }
      const entry: ServiceState = {
        key,
        value,
        todayValue: undefined,
        description: undefined,
        sign,
      };
      owner.state.push(entry);
      describe(indent, entry);
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
        const owner = byName.get(update[1]!);
        if (owner === undefined) return fail(`Unknown service ${update[1]}.`);
        if (!owner.state.some((entry) => entry.key === update[2]))
          return fail(
            `${owner.name} has no state ${update[2]}. Declare it with state ${update[2]} = <initial value>.`,
          );
        const sign = signWithin(step, "step");
        if (typeof sign !== "string") return sign;
        const entry: ServiceUpdate = {
          service: owner.name,
          key: update[2]!,
          value: update[3]!.trim(),
          note: undefined,
          sign,
        };
        step.updates.push(entry);
        annotate(indent, entry);
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
) {
  const skip: Sign = side === "today" ? "+" : "-";
  const state = new Map(
    flattenServices(diagram.services).map(({ service }) => [
      service.name,
      new Map(
        service.state
          .filter((entry) => entry.sign !== skip)
          .map((entry) => [
            entry.key,
            side === "today" ? (entry.todayValue ?? entry.value) : entry.value,
          ]),
      ),
    ]),
  );
  for (const { updates } of diagram.steps.slice(0, step))
    for (const update of updates)
      if (update.sign !== skip)
        state.get(update.service)!.set(update.key, update.value);
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
