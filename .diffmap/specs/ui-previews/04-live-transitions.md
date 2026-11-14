# Phase 4: Live transitions

[Phase 3](03-flow-block.md) shows each state of a flow by rendering its story from scratch. Selecting the next state swaps the UI at once, so the app's own transitions never play.

**Today**

flow-preview solves this with an optional `persistentPreview`, a single long-lived UI that its scenario drives between states, and the scenario has to track what it has applied so far.

**Proposed**

A story's `play` function already says how a person reaches it: the `Saved` story clicks Save. So when the reader moves from a state to one of its children, with the next-step button or the strip, the viewer sends `preview-show` with `how: "play"`. The page keeps the parent's UI mounted and runs only the child's `play` on it, so menus open, heights animate, and messages appear as they do in the app. Any other jump, such as back or to a distant state, renders the target from scratch, as Phase 1 does.

```callstack [Moving to the next state]
onMessage(preview-show, how: "play")
├── child = catalog[story]
├── await child.load() # its loaders and beforeEach
├── await child.play({ canvasElement: liveContainer }) # on the parent's UI
└── post preview-state for the child
```

This works when the child's `play` starts from what the parent shows, which is how a flow's stories are written. The guide says so, and asks for `play` steps paced so a reader can follow them, such as `userEvent.setup({ delay })`. If `play` throws, the page posts `preview-error`, and the viewer renders the child from scratch instead.

Thumbnails always render from scratch, so they stay fixed end states. The reader's reduced-motion setting reaches the app through the iframe, as it does in a browser tab.

```changes

```
