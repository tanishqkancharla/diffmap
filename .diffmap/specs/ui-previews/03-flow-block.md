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
    auth-log-in--wrong-password: Log in with the wrong password
    auth-log-in--two-factor: Log in to a 2-factor account
      auth-log-in--signed-in: Enter the code
  auth-log-in--forgot: Click "Forgot password?"
```
````

The first line is the starting state. **Each later story is one step from the story it is indented under:** its `play` does what the person does, and its `msw` handlers say how the server answers. So a state is the path of stories that leads to it, and the journey lives in the spec rather than in the stories.

[[f914dad:src/parseFence.ts#L235-L281]] parses the tree, and `validate` names what is wrong: a line indented under nothing, an action on the starting state, a missing action, a line that is not a story ID, or a story listed twice.

The page learns paths. `preview-show` carries `path`, the story IDs from the start to the state, and the page's URL carries it as `?story=<id>&path=<ids>` so a frame loads straight into a state. Showing a path from scratch renders the first story, then loads and runs each later story's steps at once ([[f914dad:src/preview/PreviewRoute.tsx#L170-L202]]). Loading a story first runs its loaders, which is where the MSW addon swaps in that story's fake server. A path that does not end at the story is ignored, and the page renders the story alone ([[f914dad:src/preview/protocol.ts#L84-L93]]).

```ts
// viewer → page
{ type: "preview-show", story, how: "render" | "play", path?: [start, ..., story] }
// [!note path] Stories from the flow's start to this state. Without it, the page renders the story alone, as in Phase 1.
```

The block is one live frame, with the viewer's controls around it ([[f914dad:src/viewer/previews/FlowBlock.tsx#L44-L380]]):

- **Breadcrumbs** from the starting state to the selected one, each a button back to that state.
- **Back and next-step buttons.** Each next-step button is labeled with its action, such as "Log in with the wrong password", and a state with several children shows one per child. A state with none says it is the end of the path.
- **The state's note**, from the story's description, and its **Reviewed** checkbox, keyed to the path and the state's fingerprint.
- **A strip of thumbnails** of every state, each the app rendered at 720 pixels wide and scaled down, inert, captioned with the action that reaches it. The strip scrolls to the selected state. Thumbnails load once the live frame has connected, so a page of flows loads the app as the reader reaches each one.
- **Arrow keys** move to the first child and back to the parent while the block has focus.

```callstack [Showing a flow fence]
 view = Fence(fence) [[f914dad:src/viewer/Fence.tsx#L64-L67]]
+└── return FlowBlock(fence)
+    ├── live = PreviewFrame(page, [start]) # the one the reader drives
+    ├── strip = states.map((state) => PreviewFrame(page, statePath(state), "thumbnail")) [[f914dad:src/viewer/previews/flowTree.ts#L4-L13]]
+    └── select(state) [[f914dad:src/viewer/previews/FlowBlock.tsx#L81-L92]]
+        └── live.post({ type: "preview-show", path: statePath(state), how })
```

Before the page has answered, states read as names made from their IDs, so `auth-log-in--wrong-password` reads "Wrong Password", the same as Storybook's own name for the story.

Checked in Chrome against [`fixtures/previews-app`](07-examples.md) with five flows on one page: log-in, sign-up, checkout, search, and upload. All 37 frames reached their states, including the ones that need the server's answer (wrong password, locked, two-factor, email taken, card declined, search results, no results, file too large, connection dropped). Jumping from `Wrong Password` to `Reset Sent` rendered the reset screen from scratch.

```changes
e7b0bd1..f914dad
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
