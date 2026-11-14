import type { ReactNode } from "react";

export type FlowRenderContext = {
  /** Shows another state of this flow, as the viewer's next-step button does. */
  go: (stateId: string) => void;
};

export type FlowStateDefinition = {
  id: string;
  title: string;
  /** The state this one follows; the viewer draws the path from the initial state as breadcrumbs. */
  parent?: string;
  /** What the user does in the parent state to reach this one, such as "Save preferences". */
  action?: string;
  note?: string;
  render: (context: FlowRenderContext) => ReactNode;
};

export type FlowDefinition = {
  id: string;
  title: string;
  initialState: string;
  states: FlowStateDefinition[];
};

/** A flow's states without their render functions, as the route sends them to the viewer. */
export type FlowSummary = {
  id: string;
  title: string;
  initialState: string;
  states: Omit<FlowStateDefinition, "render">[];
};

export const FLOW_PROTOCOL = 1;

export type FlowRouteMessage =
  | { type: "flow-hello"; protocol: typeof FLOW_PROTOCOL }
  | { type: "flow-ready"; protocol: typeof FLOW_PROTOCOL; flow: FlowSummary }
  | { type: "flow-size"; width: number; height: number }
  | { type: "flow-state"; state: string; fingerprint: string }
  | { type: "flow-error"; message: string };

export type FlowViewerMessage =
  | { type: "flow-connect" }
  | { type: "flow-show"; state: string; how: "render" | "enter" }
  | { type: "flow-mode"; mode: "preview" | "thumbnail" };

export function defineFlow(flow: FlowDefinition): FlowDefinition {
  return flow;
}

/** The pages that may frame the route: the local viewer, which listens on any port, and diffmap.dev. */
export function isViewerOrigin(origin: string) {
  if (origin === "https://www.diffmap.dev") return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return (
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost")
  );
}

/** The `Content-Security-Policy` the route's page should be served with, so only the viewer can frame it. */
export const flowFrameAncestors =
  "frame-ancestors 'self' http://127.0.0.1:* http://localhost:* https://www.diffmap.dev";

export function parseViewerMessage(
  data: unknown,
): FlowViewerMessage | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const message = data as Record<string, unknown>;
  switch (message.type) {
    case "flow-connect":
      return { type: "flow-connect" };
    case "flow-show":
      if (typeof message.state !== "string") return undefined;
      return {
        type: "flow-show",
        state: message.state,
        how: message.how === "enter" ? "enter" : "render",
      };
    case "flow-mode":
      if (message.mode !== "preview" && message.mode !== "thumbnail")
        return undefined;
      return { type: "flow-mode", mode: message.mode };
    default:
      return undefined;
  }
}

/** FNV-1a of the state's rendered HTML: it changes when the markup or its classes do, so review marks can tell a state changed. */
export function fingerprint(html: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < html.length; index++) {
    hash ^= html.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function summarizeFlow(flow: FlowDefinition): FlowSummary {
  return {
    id: flow.id,
    title: flow.title,
    initialState: flow.initialState,
    states: flow.states.map(({ render: _render, ...state }) => state),
  };
}

/** What `import.meta.glob("./*.flow.tsx", { eager: true })` returns, or the flows themselves. */
export type FlowModules = Record<string, unknown> | FlowDefinition[];

export type ResolvedFlows = {
  flows: Map<string, FlowDefinition>;
  /** Mistakes in the flow files, shown in place of any flow so the agent fixes them first. */
  problems: string[];
};

export function resolveFlows(modules: FlowModules): ResolvedFlows {
  const entries: [string, unknown][] = Array.isArray(modules)
    ? modules.map((flow, index) => [`flow ${index + 1}`, flow])
    : Object.entries(modules).map(([file, module]) => [
        file,
        typeof module === "object" && module !== null && "default" in module
          ? module.default
          : undefined,
      ]);
  const flows = new Map<string, FlowDefinition>();
  const problems: string[] = [];
  for (const [source, value] of entries) {
    if (!isFlowDefinition(value)) {
      problems.push(`${source} does not default-export defineFlow({ ... }).`);
      continue;
    }
    if (flows.has(value.id)) {
      problems.push(`${source} reuses the flow ID "${value.id}".`);
      continue;
    }
    flows.set(value.id, value);
    problems.push(...flowProblems(value));
  }
  return { flows, problems };
}

function isFlowDefinition(value: unknown): value is FlowDefinition {
  if (typeof value !== "object" || value === null) return false;
  const flow = value as Record<string, unknown>;
  return (
    typeof flow.id === "string" &&
    typeof flow.title === "string" &&
    typeof flow.initialState === "string" &&
    Array.isArray(flow.states)
  );
}

function flowProblems(flow: FlowDefinition) {
  const problems: string[] = [];
  const states = new Map<string, FlowStateDefinition>();
  for (const state of flow.states) {
    if (states.has(state.id))
      problems.push(`Flow "${flow.id}" has two states named "${state.id}".`);
    states.set(state.id, state);
  }
  if (!states.has(flow.initialState))
    problems.push(
      `Flow "${flow.id}" starts at "${flow.initialState}", which is not one of its states.`,
    );
  for (const state of flow.states) {
    if (state.parent === undefined) continue;
    if (!states.has(state.parent)) {
      problems.push(
        `State "${state.id}" in flow "${flow.id}" follows "${state.parent}", which is not one of its states.`,
      );
      continue;
    }
    const seen = new Set([state.id]);
    for (
      let parent = states.get(state.parent);
      parent !== undefined;
      parent =
        parent.parent === undefined ? undefined : states.get(parent.parent)
    ) {
      if (seen.has(parent.id)) {
        problems.push(
          `State "${state.id}" in flow "${flow.id}" leads back to itself through its parents.`,
        );
        break;
      }
      seen.add(parent.id);
    }
  }
  return problems;
}
