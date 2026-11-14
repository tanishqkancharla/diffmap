# Phase 3: The `flow` block

[Phase 2](02-preview-block.md) shows stories on their own. This phase joins them into a user journey, the widget flow-preview draws today, sized to the text column.

**Today**

A journey is a gallery of screenshots, and the prose says how the states connect.

**Proposed**

A `flow` fence lists stories as a tree. Each line is a story ID, indented under the story it follows, with the action that leads to it after a colon:

````text
```flow [Saving preferences]
settings-preferences--editing
  settings-preferences--empty-name: Clear the name
  settings-preferences--saved: Save preferences
```
````

The first line is the flow's starting state. The journey lives in the spec, not in the stories, so the same stories can appear in several flows and stay plain Storybook stories. [[src/parseFence.ts#parseFence]] learns the `flow` kind and parses the tree; `validate` rejects a line indented under nothing, a missing action, and a story listed twice.

The block is one live `PreviewFrame` from Phase 2, with the viewer's controls around it:

- **Breadcrumbs** from the starting state to the selected one.
- **Previous and next-step buttons.** The next-step button is labeled with the action, such as "Save preferences", and a state with several children shows one per child.
- **The state's note**, taken from the story's description.
- **A thumbnail strip** of every state: small frames in `thumbnail` mode, scaled down, inert, and loaded only when they scroll into view, so a long flow does not start a dozen copies of the app at once. Each has a review mark keyed to its fingerprint, as in Phase 2.

```callstack [Showing a flow fence]
 view = Fence(fence) [[src/viewer/Fence.tsx#Fence]]
+└── return FlowBlock(fence)
+    ├── tree = fence.flow # story IDs, parents, and actions
+    ├── live = PreviewFrame(url, tree.start)
+    ├── strip = tree.states.map((id) => PreviewFrame(url, id, "thumbnail"))
+    └── on select(state): live.post({ type: "preview-show", story: state, how: "render" })
```

`FlowBlock` is a planned name. The thumbnail strip, review marks, and keyboard handling come from flow-preview's canvas, which moves into `src/viewer/flow/` without the parts that rendered states: those now come from the app's page.

```changes

```
