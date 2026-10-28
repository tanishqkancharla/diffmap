import { parseAnnotation, type SourceAnnotation } from "./annotations.js";

/**
 * A `services` fence: services that hold state, nest sub-services, and send
 * each other events. Steps replay the events in order. Every event in a step
 * is in flight at once; the step's state updates land when they arrive.
 */
export type ServiceDiagram = {
  services: Service[];
  steps: ServiceStep[];
};

export type Service = {
  name: string;
  label: string | undefined;
  description: string | undefined;
  state: ServiceState[];
  children: Service[];
  annotation: SourceAnnotation | undefined;
};

export type ServiceState = {
  key: string;
  value: string;
  description: string | undefined;
};

export type ServiceStep = {
  /** What happens in this step, in a sentence. */
  caption: string;
  description: string | undefined;
  events: ServiceEvent[];
  updates: ServiceUpdate[];
};

export type ServiceEvent = {
  from: string;
  to: string;
  label: string;
  /** Shown beside the event's label while its step is current. */
  note: string | undefined;
  annotation: SourceAnnotation | undefined;
};

export type ServiceUpdate = {
  service: string;
  key: string;
  value: string;
  /** Shown beside the changed state while its step is current. */
  note: string | undefined;
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
const eventLine = new RegExp(
  String.raw`^(${name})\s*->\s*(${name})(?:\s*:\s*(.*))?$`,
);
const updateLine = new RegExp(String.raw`^(${name})\.(${name})\s*=\s*(.+)$`);

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
export function parseServiceDiagram(source: string): ServicesParse {
  const services: Service[] = [];
  const byName = new Map<string, Service>();
  const steps: ServiceStep[] = [];
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
  const lines = source.split("\n");
  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    const fail = (reason: string): ServicesParse => ({
      ok: false,
      line,
      reason,
    });
    const text = raw.trim();
    if (text.length === 0 || text.startsWith("%%")) continue;
    const indent = raw.replace(/\t/g, "  ").search(/\S/);
    if (text.startsWith(">")) {
      if (described === undefined || indent <= described.indent)
        return fail(
          "Put a > line directly below the service, state, step, event, or update it describes, indented further.",
        );
      described.append(text.slice(1).trim());
      continue;
    }
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
      if (owner.state.some((entry) => entry.key === key))
        return fail(`${owner.name}.${key} is declared twice.`);
      const entry = {
        key,
        value: stateMatch[2]!.trim(),
        description: undefined,
      };
      owner.state.push(entry);
      describe(indent, entry);
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
        const entry: ServiceUpdate = {
          service: owner.name,
          key: update[2]!,
          value: update[3]!.trim(),
          note: undefined,
        };
        step.updates.push(entry);
        annotate(indent, entry);
        continue;
      }
      return fail(
        `Expected an event (From -> To: label) or a state update (Service.key = value), got "${text}".`,
      );
    }

    return fail(
      `Expected service <Name>, state <key> = <value>, or step "<caption>", got "${text}".`,
    );
  }
  if (services.length === 0)
    return { ok: false, line: 1, reason: "Declare at least one service." };
  return { ok: true, diagram: { services, steps } };
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

/** State after the first `step` steps; step 0 is the declared state. */
export function serviceStateAt(diagram: ServiceDiagram, step: number) {
  const state = new Map(
    flattenServices(diagram.services).map(({ service }) => [
      service.name,
      new Map(service.state.map((entry) => [entry.key, entry.value])),
    ]),
  );
  for (const { updates } of diagram.steps.slice(0, step))
    for (const update of updates)
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
