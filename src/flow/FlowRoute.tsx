import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  FLOW_PROTOCOL,
  fingerprint,
  isViewerOrigin,
  parseViewerMessage,
  resolveFlows,
  summarizeFlow,
  type FlowModules,
  type FlowRouteMessage,
  type ResolvedFlows,
} from "./protocol.js";

/**
 * Renders one state of one flow, picked by `?flow=` and `?state=`, inside the app's own providers.
 * Framed by a diffmap viewer, it also answers the viewer's messages and reports each state it shows.
 */
export function FlowRoute({ flows }: { flows: FlowModules }) {
  const resolved = useMemo(() => resolveFlows(flows), [flows]);
  const [{ flowId, initialStateId }] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      flowId: params.get("flow") ?? undefined,
      initialStateId: params.get("state") ?? undefined,
    };
  });
  const flow = flowId === undefined ? undefined : resolved.flows.get(flowId);
  const [stateId, setStateId] = useState(initialStateId ?? flow?.initialState);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewerOrigin = useRef<string | undefined>(undefined);
  const lastSize = useRef("");
  const lastState = useRef("");

  const post = useCallback((message: FlowRouteMessage) => {
    if (viewerOrigin.current === undefined || window.parent === window) return;
    window.parent.postMessage(message, viewerOrigin.current);
  }, []);

  const reportState = useCallback(() => {
    const content = contentRef.current;
    if (stateId === undefined || content === null) return;
    const reported = {
      state: stateId,
      fingerprint: fingerprint(content.innerHTML),
    };
    const key = `${reported.state} ${reported.fingerprint}`;
    if (key === lastState.current) return;
    lastState.current = key;
    post({ type: "flow-state", ...reported });
  }, [post, stateId]);

  const reportSize = useCallback(() => {
    const content = contentRef.current;
    if (content === null) return;
    const width = content.offsetWidth;
    const height = content.offsetHeight;
    const size = `${width}x${height}`;
    if (size === lastSize.current) return;
    lastSize.current = size;
    post({ type: "flow-size", width, height });
  }, [post]);

  const go = useCallback(
    (nextStateId: string) => {
      if (flow === undefined) return;
      if (!flow.states.some((state) => state.id === nextStateId)) {
        post({
          type: "flow-error",
          message: `Flow "${flow.id}" has no state "${nextStateId}".`,
        });
        return;
      }
      setStateId(nextStateId);
      const url = new URL(window.location.href);
      url.searchParams.set("flow", flow.id);
      url.searchParams.set("state", nextStateId);
      window.history.replaceState(window.history.state, "", url);
    },
    [flow, post],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || !isViewerOrigin(event.origin))
        return;
      const message = parseViewerMessage(event.data);
      if (message === undefined) return;
      if (message.type === "flow-connect") {
        viewerOrigin.current = event.origin;
        lastSize.current = "";
        lastState.current = "";
        if (flow === undefined) {
          post({ type: "flow-error", message: missingFlowMessage(flowId) });
          return;
        }
        post({
          type: "flow-ready",
          protocol: FLOW_PROTOCOL,
          flow: summarizeFlow(flow),
        });
        reportSize();
        reportState();
        return;
      }
      if (event.origin !== viewerOrigin.current) return;
      // Phase 3 runs a state's steps on the live UI for "enter"; until then both render the state.
      if (message.type === "flow-show") go(message.state);
      else document.documentElement.dataset.flowMode = message.mode;
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [flow, flowId, go, post, reportSize, reportState]);

  useEffect(() => {
    // The viewer's flow-connect can arrive before React mounts the listener, so the route asks for it once it listens.
    // The hello goes to any parent because it carries nothing; the flow itself only goes to a viewer origin that connects.
    if (window.parent !== window)
      window.parent.postMessage(
        {
          type: "flow-hello",
          protocol: FLOW_PROTOCOL,
        } satisfies FlowRouteMessage,
        "*",
      );
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(reportState);
    return () => cancelAnimationFrame(frame);
  }, [reportState]);

  useEffect(() => {
    const content = contentRef.current;
    if (content === null) return;
    const observer = new ResizeObserver(reportSize);
    observer.observe(content);
    return () => observer.disconnect();
  }, [reportSize]);

  return (
    <FlowView
      resolved={resolved}
      flowId={flowId}
      stateId={stateId}
      go={go}
      contentRef={contentRef}
    />
  );
}

export function FlowView({
  resolved,
  flowId,
  stateId,
  go,
  contentRef,
}: {
  resolved: ResolvedFlows;
  flowId: string | undefined;
  stateId: string | undefined;
  go: (stateId: string) => void;
  contentRef?: RefObject<HTMLDivElement | null>;
}) {
  if (resolved.problems.length > 0)
    return (
      <Notice title="Fix these flow files">
        <ul>
          {resolved.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </Notice>
    );
  const flow = flowId === undefined ? undefined : resolved.flows.get(flowId);
  if (flow === undefined)
    return (
      <Notice title={missingFlowMessage(flowId)}>
        <FlowIndex resolved={resolved} />
      </Notice>
    );
  const state = flow.states.find((candidate) => candidate.id === stateId);
  if (state === undefined)
    return (
      <Notice title={`Flow "${flow.id}" has no state "${stateId}".`}>
        <FlowIndex
          resolved={{ ...resolved, flows: new Map([[flow.id, flow]]) }}
        />
      </Notice>
    );
  return (
    <div
      ref={contentRef}
      data-flow-state={state.id}
      style={{ display: "flow-root" }}
    >
      {state.render({ go })}
    </div>
  );
}

function missingFlowMessage(flowId: string | undefined) {
  return flowId === undefined ? "Pick a flow" : `There is no flow "${flowId}".`;
}

function FlowIndex({ resolved }: { resolved: ResolvedFlows }) {
  if (resolved.flows.size === 0)
    return <p>No flows yet. Add a file that default-exports defineFlow.</p>;
  return (
    <ul>
      {[...resolved.flows.values()].map((flow) => (
        <li key={flow.id}>
          {flow.title}
          <ul>
            {flow.states.map((state) => (
              <li key={state.id}>
                <a
                  href={`?${new URLSearchParams({ flow: flow.id, state: state.id })}`}
                >
                  {state.title}
                </a>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

const noticeStyle: CSSProperties = {
  margin: 16,
  padding: 16,
  border: "1px solid currentColor",
  borderRadius: 8,
  font: "14px/1.5 system-ui, sans-serif",
};

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="alert" data-flow-notice="" style={noticeStyle}>
      <strong>{title}</strong>
      {children}
    </div>
  );
}
