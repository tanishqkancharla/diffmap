# ✅ Phase 3: The `flow` block

[Phase 2](02-preview-block.md) shows stories on their own. This phase joins them into a user journey, the widget flow-preview draws today, sized to the text column.

**Today**

A journey is a gallery of screenshots, and the prose says how the states connect.

**Proposed**

A `flow` fence lists stories as a tree. Each line is a story ID, indented under the story it follows, with the action that leads to it after a colon:

````text
```flow [Logging in]
auth-log-in--empty
  auth-log-in--filled: Fill in email and password
    auth-log-in--two-factor: Log in
      auth-log-in--signed-in: Enter the code
    auth-log-in--wrong-password: Log in with the wrong password
  auth-log-in--forgot: Click "Forgot password?"
```
````

The first line is the starting state. **Each later story is one step from the story it is indented under:** its `play` does what the person does, and its `msw` handlers say how the server answers. So a state is the path of stories that leads to it, and the journey lives in the spec rather than in the stories.

[[d982acf:src/parseFence.ts#L235-L281]] parses the tree, and `validate` names what is wrong: a line indented under nothing, an action on the starting state, a missing action, a line that is not a story ID, or a story listed twice.

The page learns paths. `preview-show` carries `path`, the story IDs from the start to the state, and the page's URL carries it as `?story=<id>&path=<ids>` so a frame loads straight into a state. Showing a path from scratch renders the first story, then loads and runs each later story's steps at once ([[d982acf:src/preview/PreviewRoute.tsx#L170-L202]]). Loading a story first runs its loaders, which is where the MSW addon swaps in that story's fake server. A path that does not end at the story is ignored, and the page renders the story alone ([[d982acf:src/preview/protocol.ts#L84-L93]]).

```ts
// viewer → page
{ type: "preview-show", story, how: "render" | "play", path?: [start, ..., story] }
// [!note path] Stories from the flow's start to this state. Without it, the page renders the story alone, as in Phase 1.
```

The block is one live frame, with the viewer's controls around it ([[e45db07:src/viewer/previews/FlowBlock.tsx#L48-L423]]):

- **The header** has breadcrumbs from the starting state to the selected one, each a button back to that state, and in its right corner the state's **Reviewed** checkbox, keyed to the path and the state's fingerprint. It is the diff panel's [[src/viewer/ReviewedCheckbox.tsx#ReviewedCheckbox]].
- **Under the frame,** Back sits on the left, then the state's note, from the story's description. On the right is a segmented next-step button. Its main half follows the first state listed under this one, so **a fence lists the happy path first**, and is labeled with that action, such as "Fill in email and password". The arrow beside it opens a menu of the state's other steps. A state with no children says it is the end of the path.
- **Beside the frame,** a narrow sidebar lists every state as a compact text tree, indented by depth, in the order the fence lists them, so the happy path comes first. The selected state is highlighted, the states on the path to it are darker than the rest, and a reviewed state has a check. Clicking a state jumps straight to it, as the breadcrumbs do, and hovering one shows the action that reaches it. The sidebar is as tall as the frame and scrolls on its own. Thumbnails of the states are left for the expanded view in [Phase 5](05-expanded-flow.md), so a flow on the page loads one frame of the app, not one per state.
- **Arrow keys** move down the happy path and back to the parent while the block has focus.

```callstack [Showing a flow fence]
 view = Fence(fence) [[d982acf:src/viewer/Fence.tsx#L64-L67]]
+└── return FlowBlock(fence)
+    ├── live = PreviewFrame(page, [start]) # the one the reader drives
+    ├── tree = showAll && states.map((state) => PreviewFrame(page, statePath(state), "thumbnail")) [[d982acf:src/viewer/previews/flowTree.ts#L4-L13]]
+    └── select(state) [[8031163:src/viewer/previews/FlowBlock.tsx#L86-L97]]
+        └── live.post({ type: "preview-show", path: statePath(state), how })
```

Before the page has answered, states read as names made from their IDs, so `auth-log-in--wrong-password` reads "Wrong Password", the same as Storybook's own name for the story.

Checked in Chrome against [`fixtures/previews-app`](07-examples.md) with five flows on one page: log-in, sign-up, checkout, search, and upload. All 37 frames reached their states, including the ones that need the server's answer (wrong password, locked, two-factor, email taken, card declined, search results, no results, file too large, connection dropped). Jumping from `Wrong Password` to `Reset Sent` rendered the reset screen from scratch. Reviewing a state from the header and from its card in the tree marked the same state, since both frames report the same fingerprint.

```changes
2df4c53..e45db07
src/parseFence.ts
src/parseViewer.ts
src/preview/protocol.ts
src/preview/PreviewRoute.tsx
src/preview/preview.test.tsx
src/viewer/previews/FlowBlock.tsx
src/viewer/previews/flowTree.ts
src/viewer/previews/previews.test.ts
fixtures/previews-app/src/auth/AuthFlow.stories.tsx
fixtures/previews-app/src/auth/AuthFlow.tsx

ignore:
fixtures/previews-app/src/app.css
```
