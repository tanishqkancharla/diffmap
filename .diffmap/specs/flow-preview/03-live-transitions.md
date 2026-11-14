# Phase 3: Live transitions

[Phase 2](02-inline-widget.md) shows each state by rendering it. Selecting the next state swaps the UI at once, so the app's own transitions never play.

**Today**

flow-preview solves this with an optional `persistentPreview`, a single long-lived UI that the scenario drives between any two states, and the scenario has to track what it has applied so far.

**Proposed**

A state can declare `enter`, the steps a person takes from its parent to reach it. When the reader moves from a state to one of its children with the next-step button or the strip, the viewer sends `flow-show` with `how: "enter"`. The route keeps the live UI mounted and runs those steps on it, so menus open, heights animate, and messages appear as they do in the app. Any other jump, such as back or to a distant state, renders the target directly.

```ts
enter: async (ui) => {
  await ui.type("Digest name", "Weekly digest");
  await ui.click("Save preferences");
};
// [!note ui] Finds controls by their accessible name and acts on them at a pace a reader can follow.
```

`ui` is a few helpers in `@tanishqkancharla/diffmap/flow`, `click`, `type`, `select`, and `wait`. They are written for this route, not taken from a testing library, so the app gains no test dependency. Thumbnails always use `render`, so they stay fixed end states, and the reader's reduced-motion setting is passed through to the app.

```changes

```
