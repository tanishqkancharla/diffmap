# Phase 2: The inline flow widget

[Phase 1](01-flows-route.md) gave the app a route that renders flow states. This phase draws the widget in the spec.

**Today**

A spec shows a journey as screenshots in a gallery ([[src/viewer/Media.tsx]]).

**Proposed**

A `flow` fence renders the inline widget. The viewer reads `userFlows` from `.diffmap/config.json`, loads `<userFlows.local>?flow=preferences` in an iframe, connects as [Phase 1](01-flows-route.md) describes, and waits for `flow-ready`. It then draws the breadcrumbs, previous and next-step buttons, note, and thumbnail strip itself, with Maui, as the other fences do.

```callstack [Showing a flow fence]
 view = Fence(fence) [[src/viewer/Fence.tsx#Fence]]
+└── return FlowWidget(fence)
+    ├── url = flowUrl(flowsConfig, viewerMode) # local, or the PR's preview
+    ├── live = iframe(url + "?flow=" + fence.flow)
+    ├── live.post({ type: "flow-connect" }) # on load, and on flow-hello
+    ├── flow = await message("flow-ready") # or flow-error: show its message
+    ├── strip = flow.states.map(thumbnailFrame) # lazy, inert iframes
+    └── on select(state): live.post({ type: "flow-show", state, how: "render" })
```

`FlowWidget`, `flowUrl`, and `thumbnailFrame` are planned names. [[src/parseFence.ts#parseFence]] learns the `flow` kind, whose body is one flow ID.

- **The live preview** is one iframe. It grows with `flow-size` up to a height cap, then scrolls.
- **Thumbnails** are small iframes in `thumbnail` mode, scaled down, inert, and loaded only when they scroll into view, so a long flow does not start a dozen copies of the app at once.
- **Review marks** sit on each thumbnail and are stored in `localStorage` per spec, flow, and state, keyed to the state's `fingerprint`, the same way [[src/viewer/reviewed.ts#useReviewedFiles]] keys reviewed files to their diff. A state whose UI changes needs reviewing again.
- **When the route cannot be reached,** the widget says so in place, with the URL it tried, such as "Start your dev server at http://localhost:5173". `serve` adds the same message to its `warnings`.

The local viewer's content security policy ([[src/serve.ts#contentSecurityPolicy]]) only restricts scripts, objects, and the base URL, so it does not block the iframe. `validate` checks that each `flow` fence names one ID and that `.diffmap/config.json` has a `userFlows` key; it does not reach the app.

```changes

```
