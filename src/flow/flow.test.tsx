import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FlowView } from "./FlowRoute.tsx";
import {
  defineFlow,
  fingerprint,
  isViewerOrigin,
  parseViewerMessage,
  resolveFlows,
  summarizeFlow,
} from "./protocol.ts";

const preferences = defineFlow({
  id: "preferences",
  title: "Saving preferences",
  initialState: "editing",
  states: [
    {
      id: "editing",
      title: "Editing",
      render: ({ go }) => (
        <button type="button" onClick={() => go("saved")}>
          Save preferences
        </button>
      ),
    },
    {
      id: "saved",
      title: "Saved",
      parent: "editing",
      action: "Save preferences",
      render: () => <p>Saved</p>,
    },
  ],
});

test("only the local viewer and diffmap.dev may drive a flow", () => {
  assert.equal(isViewerOrigin("http://127.0.0.1:4310"), true);
  assert.equal(isViewerOrigin("http://localhost:5173"), true);
  assert.equal(isViewerOrigin("https://www.diffmap.dev"), true);
  assert.equal(isViewerOrigin("https://diffmap.dev.attacker.example"), false);
  assert.equal(isViewerOrigin("https://127.0.0.1:4310"), false);
  assert.equal(isViewerOrigin("http://127.0.0.1.attacker.example"), false);
  assert.equal(isViewerOrigin("null"), false);
});

test("the route accepts only well-formed viewer messages", () => {
  assert.deepEqual(parseViewerMessage({ type: "flow-connect" }), {
    type: "flow-connect",
  });
  assert.deepEqual(parseViewerMessage({ type: "flow-show", state: "saved" }), {
    type: "flow-show",
    state: "saved",
    how: "render",
  });
  assert.deepEqual(
    parseViewerMessage({ type: "flow-mode", mode: "thumbnail" }),
    { type: "flow-mode", mode: "thumbnail" },
  );
  assert.equal(parseViewerMessage({ type: "flow-show" }), undefined);
  assert.equal(parseViewerMessage({ type: "flow-mode", mode: "x" }), undefined);
  assert.equal(parseViewerMessage("flow-connect"), undefined);
});

test("a state's fingerprint changes with its markup", () => {
  assert.equal(fingerprint("<p>Saved</p>"), fingerprint("<p>Saved</p>"));
  assert.notEqual(
    fingerprint('<p class="a">Saved</p>'),
    fingerprint('<p class="b">Saved</p>'),
  );
  assert.match(fingerprint(""), /^[0-9a-f]{8}$/);
});

test("the viewer gets a flow's states without their render functions", () => {
  assert.deepEqual(summarizeFlow(preferences), {
    id: "preferences",
    title: "Saving preferences",
    initialState: "editing",
    states: [
      { id: "editing", title: "Editing" },
      {
        id: "saved",
        title: "Saved",
        parent: "editing",
        action: "Save preferences",
      },
    ],
  });
});

test("flow files are read from import.meta.glob and their mistakes named", () => {
  const resolved = resolveFlows({
    "./preferences.flow.tsx": { default: preferences },
    "./copy.flow.tsx": { default: preferences },
    "./empty.flow.tsx": {},
    "./broken.flow.tsx": {
      default: defineFlow({
        id: "broken",
        title: "Broken",
        initialState: "missing",
        states: [
          { id: "a", title: "A", parent: "b", render: () => undefined },
          { id: "b", title: "B", parent: "a", render: () => undefined },
          { id: "c", title: "C", parent: "gone", render: () => undefined },
        ],
      }),
    },
  });
  assert.deepEqual([...resolved.flows.keys()], ["preferences", "broken"]);
  assert.deepEqual(resolved.problems, [
    './copy.flow.tsx reuses the flow ID "preferences".',
    "./empty.flow.tsx does not default-export defineFlow({ ... }).",
    'Flow "broken" starts at "missing", which is not one of its states.',
    'State "a" in flow "broken" leads back to itself through its parents.',
    'State "b" in flow "broken" leads back to itself through its parents.',
    'State "c" in flow "broken" follows "gone", which is not one of its states.',
  ]);
});

test("the route renders the state the URL names, or says what is missing", () => {
  const resolved = resolveFlows([preferences]);
  const render = (flowId?: string, stateId?: string) =>
    renderToStaticMarkup(
      <FlowView
        resolved={resolved}
        flowId={flowId}
        stateId={stateId}
        go={() => {}}
      />,
    );
  assert.equal(
    render("preferences", "saved"),
    '<div data-flow-state="saved" style="display:flow-root"><p>Saved</p></div>',
  );
  assert.match(render("preferences", "editing"), /Save preferences<\/button>/);
  assert.match(render("settings"), /There is no flow &quot;settings&quot;/);
  assert.match(
    render(),
    /Pick a flow.*href="\?flow=preferences&amp;state=saved"/,
  );
  assert.match(
    render("preferences", "gone"),
    /has no state &quot;gone&quot;.*Editing/,
  );
});
