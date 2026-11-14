# ✅ Phase 1: The `/__flows` route

The [cover](README.md) describes the widget and why the app renders its own states. Nothing in diffmap knew about flows before this phase. It gives an app a page that can render any state of any flow, and the messages diffmap will use to drive it.

**Today**

To preview a state, an agent builds a separate app in `tmp/` and recreates the project's styles and providers inside it.

**Proposed**

The package gains a small entry point, `@tanishqkancharla/diffmap/flow`, next to the `.` export in [[c9eab9c:package.json]]. It exports `defineFlow` and a `FlowRoute` component, from [[c9eab9c:src/flow/index.ts]]. React is an optional peer dependency, so installing diffmap for its CLI pulls in nothing new.

The app mounts `FlowRoute` on a dev-only route, inside its normal root layout and providers. The agent picks the route's form from the app's framework. For a Vite app, it is an extra `flows.html` entry that Vite serves in dev and that the build leaves out:

```tsx [src/flows/main.tsx]
import { createRoot } from "react-dom/client";
import { FlowRoute } from "@tanishqkancharla/diffmap/flow";
import { AppProviders } from "../AppProviders";
import "../styles/global.css";

const flows = import.meta.glob("./*.flow.tsx", { eager: true });

createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <FlowRoute flows={flows} />
  </AppProviders>,
);
```

A page cannot set its own `frame-ancestors`, so the dev server sends it. The entry exports the policy as `flowFrameAncestors`, which allows `'self'`, the local viewer on `127.0.0.1` or `localhost` on any port, and `https://www.diffmap.dev`:

```ts [vite.config.ts]
import { flowFrameAncestors } from "@tanishqkancharla/diffmap/flow";

export default defineConfig({
  server: { headers: { "Content-Security-Policy": flowFrameAncestors } },
});
```

In a Next.js app, it is an `app/__flows/page.tsx` that returns `notFound()` in production, with the same header set for that path in `next.config`. The guide carries both recipes.

`FlowRoute` reads `?flow=` and `?state=` from the URL and renders that state's `render`, so a state can be opened on its own while the agent builds the flow. Without `?flow=`, it lists every flow and links to each state. A mistake in a flow file shows in place of the flow, as a list the agent can fix from: a file that does not default-export `defineFlow`, a reused flow ID, two states with one ID, an initial state or parent that is not a state, or parents that loop. [[c9eab9c:src/flow/protocol.ts#L123-L147]] finds them.

```callstack [Opening a state]
FlowRoute({ flows }) [[c9eab9c:src/flow/FlowRoute.tsx#L27-L158]]
├── resolveFlows(flows): flows by ID, and problems [[c9eab9c:src/flow/protocol.ts#L123-L147]]
├── read ?flow= and ?state=; the state defaults to the flow's initialState
└── FlowView: problems, a missing flow or state, or state.render({ go }) [[c9eab9c:src/flow/FlowRoute.tsx#L160-L208]]
```

Inside the widget, it talks to the viewer with `postMessage`. The route cannot know who framed it, and the viewer's first message can arrive before React mounts the listener. So the route first says hello to its parent, with nothing in the message, and sends the flow only to a viewer origin that answers with `flow-connect`. The viewer also sends `flow-connect` when the iframe loads, so either order connects:

```ts
// route → viewer
{ type: "flow-hello", protocol: 1 } // to any parent, once the route listens
{ type: "flow-ready", protocol: 1, flow: { id, title, initialState, states: [{ id, title, parent, action, note }] } }
{ type: "flow-size", width, height } // whenever the state's box resizes
{ type: "flow-state", state, fingerprint } // after each state renders
{ type: "flow-error", message } // an unknown flow or state
// viewer → route
{ type: "flow-connect" }
{ type: "flow-show", state, how: "render" | "enter" }
{ type: "flow-mode", mode: "preview" | "thumbnail" }
// [!note fingerprint] A hash of the state's rendered HTML and classes, used for review marks.
// [!note how] "enter" runs the state's steps on the live UI; Phase 3 adds it, and until then it renders the state.
// [!note mode] Sets data-flow-mode on the route's root element, so the app can drop motion in thumbnails.
```

```callstack [Driven by the viewer]
onMessage(event) [[c9eab9c:src/flow/FlowRoute.tsx#L91-L121]]
├── ignore it unless event.source is the parent and isViewerOrigin(event.origin) [[c9eab9c:src/flow/protocol.ts#L53-L65]]
├── parseViewerMessage(event.data) [[c9eab9c:src/flow/protocol.ts#L71-L93]]
├── flow-connect: remember the origin, then post flow-ready, flow-size, and flow-state
│   └── summarizeFlow(flow): the states without render [[c9eab9c:src/flow/protocol.ts#L105-L112]]
├── other messages only from the remembered origin
├── flow-show → go(state) [[c9eab9c:src/flow/FlowRoute.tsx#L72-L89]]
│   ├── unknown state → post flow-error
│   └── set the state and replace ?state= in the URL
└── flow-mode → document.documentElement.dataset.flowMode
```

A state's `render` gets `go(stateId)`, so the real controls in a live state can move the flow on, as the Save button does in the cover's example. After each state renders, the route posts its `flow-state` with a fingerprint of its HTML ([[c9eab9c:src/flow/protocol.ts#L96-L103]]), and a `ResizeObserver` posts `flow-size` when the state's box changes. Neither repeats an unchanged report.

Checked in Chrome with a Vite app that mounts the route as above, framed by a page on another allowed origin. On connect, the route sent its hello, the flow, its size, and the `editing` state. Clicking the live Save button reported `saved` with a new fingerprint and a taller size. `flow-show` for an unknown state answered with `flow-error`, and `flow-mode` set the attribute.

```changes
c9eab9c
src/flow/index.ts
src/flow/FlowRoute.tsx
src/flow/protocol.ts
src/flow/flow.test.tsx
package.json

ignore:
package-lock.json
tsconfig.build.json
```
