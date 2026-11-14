# Phase 1: The `/__flows` route

The [cover](README.md) describes the widget and why the app renders its own states. Nothing in diffmap knows about flows yet. This phase gives an app a page that can render any state of any flow, and the messages diffmap will use to drive it.

**Today**

To preview a state, an agent builds a separate app in `tmp/` and recreates the project's styles and providers inside it.

**Proposed**

The package gains a small entry point, `@tanishqkancharla/diffmap/flow`, next to today's `.` export in [[package.json]]. It exports `defineFlow` and a `FlowRoute` component. The app mounts `FlowRoute` on a dev-only route, inside its normal root layout and providers. The agent picks the route's form from the app's framework. For a Vite app, it is an extra `flows.html` entry that Vite serves in dev and that the build leaves out:

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

In a Next.js app, it is an `app/__flows/page.tsx` that returns `notFound()` in production. The guide carries both recipes.

`FlowRoute` reads `?flow=` and `?state=` from the URL and renders that state's `render`, so a state can be opened on its own while the agent builds the flow. Inside the widget, it talks to the viewer with `postMessage`:

```ts
// route → viewer
{ type: "flow-ready", protocol: 1, flow: { id, title, initialState, states: [{ id, title, parent, action, note }] } }
{ type: "flow-size", width, height }
{ type: "flow-state", state, fingerprint } // after each state renders
// viewer → route
{ type: "flow-show", state, how: "render" | "enter" }
{ type: "flow-mode", mode: "preview" | "thumbnail" }
// [!note fingerprint] A hash of the state's rendered HTML and classes, used for review marks.
// [!note how] "enter" runs the state's steps on the live UI; Phase 3 adds it.
```

A state's `render` gets `go(stateId)`, so the real controls in a live state can move the flow on, as the Save button does in the example above. `FlowRoute` only answers messages from the viewer origins it allows: the local viewer on `127.0.0.1` and `https://www.diffmap.dev`. The route also sends a `frame-ancestors` policy that names the same origins, so other sites cannot frame it.

```changes

```
