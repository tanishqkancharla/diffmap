# ✅ Phase 4: Live transitions

[Phase 3](03-flow-block.md) can show any state of a flow by replaying its path at once. Moving forward that way swaps the UI in a single frame, so the reader never sees the loading state, the error arriving, or the app's own transitions.

**Today**

flow-preview solves this with an optional `persistentPreview`, a single long-lived UI that its scenario drives between states, and the scenario has to track what it has applied so far.

**Proposed**

A story's `play` already says how a person reaches it from its parent: `Wrong Password` presses Log in. So when the reader moves from the state on screen to one of its children, with the next-step button, its menu, or a card in the tree, the viewer sends `preview-show` with `how: "play"`. The page keeps the parent's UI mounted, loads the child, which swaps in the child's fake server, and runs only the child's `play` on it, paced at 35 ms per keystroke and click. The reader sees the button turn into "Logging in…", and 700 ms later the error appears, as it does in the app. Any other move, such as back or to a distant state, replays the path at once.

```callstack [Moving to the next state]
show(path, "play") [[39c48f0:src/preview/PreviewRoute.tsx#L112-L163]]
├── the state on screen is path minus its last story, so play only the last
├── await child.load() # its loaders: the MSW addon swaps in the child's handlers
├── playStep(child, paced) [[39c48f0:src/preview/PreviewRoute.tsx#L95-L111]]
│   └── child.play({ canvasElement, canvas, userEvent: userEvent.setup({ delay: 35 }) })
├── set ?story and ?path, so a reload lands on the same state
└── post preview-state for the child; if play throws, post preview-error and replay from the start
```

The page supplies `canvas` and `userEvent` to every `play`, so stories write `play: async ({ canvas, userEvent }) => …` and get the pacing without setting it up. An instant replay passes a `userEvent` with no delay, so the same steps run at once.

The viewer decides which to send ([[85f7ba9:src/viewer/previews/FlowBlock.tsx#L86-L97]]): `"play"` when the target's parent is the state the page last reported, and `"render"` otherwise. While a step plays, the header shows a spinner.

`flows.transitions` in `.diffmap/config.json` turns this off: `"render"` replays every state at once, for an app whose stories do not chain. It defaults to `"play"`. Thumbnails always replay at once, so they stay fixed end states. The reader's reduced-motion setting reaches the app through the iframe, as it does in a browser tab.

Checked in Chrome on the log-in flow: from `Empty`, "Fill in email and password" typed the email letter by letter (0.4 seconds in, the field read `ada@acme.`); "Log in with the wrong password" then showed "Logging in…" while the fake server waited, and the error after it answered 401. On the checkout flow, "Pay with a card that's declined" showed the card processor's decline, and "Try another card" played on from there.

```changes
a5ec180..85f7ba9
src/preview/PreviewRoute.tsx
src/preview/protocol.ts
src/viewer/previews/FlowBlock.tsx
fixtures/previews-app/.storybook/preview.tsx
fixtures/previews-app/src/checkout/Checkout.stories.tsx
fixtures/previews-app/src/checkout/Checkout.tsx

ignore:
.diffmap/config.json
.diffmap/specs/ui-previews/02-preview-block.md
.diffmap/specs/ui-previews/03-flow-block.md
.diffmap/specs/ui-previews/04-live-transitions.md
.diffmap/specs/ui-previews/05-expanded-flow.md
.diffmap/specs/ui-previews/06-diffmap-dev-and-guide.md
.diffmap/specs/ui-previews/07-examples.md
.diffmap/specs/ui-previews/README.md
.diffmap/specs/ui-previews/media/flow-block.png
.diffmap/specs/ui-previews/media/flow-expanded.png
.diffmap/specs/ui-previews/media/preview-block.png
fixtures/previews-app/.storybook/main.ts
fixtures/previews-app/index.html
fixtures/previews-app/package.json
fixtures/previews-app/previews.html
fixtures/previews-app/public/mockServiceWorker.js
fixtures/previews-app/src/app.css
fixtures/previews-app/src/auth/AuthFlow.stories.tsx
fixtures/previews-app/src/auth/AuthFlow.tsx
fixtures/previews-app/src/main.tsx
fixtures/previews-app/src/previews/main.tsx
fixtures/previews-app/src/search/Search.stories.tsx
fixtures/previews-app/src/search/Search.tsx
fixtures/previews-app/src/signup/Signup.stories.tsx
fixtures/previews-app/src/signup/Signup.tsx
fixtures/previews-app/src/ui.stories.tsx
fixtures/previews-app/src/ui.tsx
fixtures/previews-app/src/upload/Upload.stories.tsx
fixtures/previews-app/src/upload/Upload.tsx
fixtures/previews-app/tsconfig.json
fixtures/previews-app/vite.config.ts
package.json
src/diffmapConfig.ts
src/parseFence.ts
src/parseViewer.ts
src/preview/preview.test.tsx
src/serve.ts
src/viewer/Fence.tsx
src/viewer/previews/PreviewBlock.tsx
src/viewer/previews/PreviewFrame.tsx
src/viewer/previews/config.ts
src/viewer/previews/flowTree.ts
src/viewer/previews/previews.test.ts
src/viewer/previews/reviewedStates.ts
```
