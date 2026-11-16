# ✅ Phase 5: Expand a flow to the full canvas

[Phase 3](03-flow-block.md) and [Phase 4](04-live-transitions.md) built the inline flow block. This phase adds its expanded view.

**Today**

Diagrams and images expand into a full-window `Dialog` that draws a second copy of the content ([[src/viewer/MermaidBlock.tsx#MermaidBlock]]).

**Proposed**

The expand button opens the flow over the page as two parts: the live screen, and the tree of states drawn as thumbnails. The inline block's text tree is left out, since the thumbnail tree answers the same question with pictures. The header's breadcrumbs still say where the reader is.

A second copy would reload the app and lose what the reader typed, and moving an iframe to a new place in the page reloads it too. So nothing moves: the block's own card becomes a fixed panel over a scrim, and the tree of states takes the place of the text tree beside the live frame. React keeps every frame in the same position in the tree, so none of them reload. The block's height is held in the page while it is expanded, so the text below does not jump, and the page behind it stops scrolling.

- **The tree** lays the states out left to right, each state to the right of the one it follows and centered on its own children ([[39c48f0:src/viewer/previews/flowTree.ts#L41-L62]]). Each card is the app rendered at 720 pixels wide and scaled down, inert, captioned with the action that reaches it, and clicking it jumps to that state. Curved edges join the cards, and the path to the selected state is drawn in the accent color. Each card has its own Reviewed checkbox in its corner; a reviewed card fades and shows a green check circle, as flow-preview's canvas does, and the live screen never shows it. The tree scrolls to center the selected state as the reader moves ([[e1093a5:src/viewer/previews/FlowBlock.tsx#L117-L131]]). Its thumbnails load only while the flow is expanded.
- **The live screen** renders at `flows.viewport` from `.diffmap/config.json`, scaled down to fit its column, so a desktop layout shows as it does at full width. Without the setting, it takes the column's width.

Checked in Chrome at 1440 by 900: the log-in flow expanded, played "Fill in email and password", "Log in", and "Enter the code" on the live screen without reloading it, highlighted that path in the tree, and collapsed with Escape to the same state. The checkout flow expanded on its `Declined` state shows the live payment screen at 1024 by 720 beside the tree.

```changes
a5ec180..e1093a5
src/viewer/previews/FlowBlock.tsx
src/viewer/previews/flowTree.ts
src/viewer/previews/PreviewFrame.tsx

ignore:
.diffmap/config.json
.diffmap/specs/ui-previews/01-preview-route.md
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
fixtures/previews-app/.storybook/preview.tsx
fixtures/previews-app/index.html
fixtures/previews-app/package.json
fixtures/previews-app/previews.html
fixtures/previews-app/public/mockServiceWorker.js
fixtures/previews-app/src/app.css
fixtures/previews-app/src/auth/AuthFlow.stories.tsx
fixtures/previews-app/src/auth/AuthFlow.tsx
fixtures/previews-app/src/checkout/Checkout.stories.tsx
fixtures/previews-app/src/checkout/Checkout.tsx
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
src/preview/PreviewRoute.tsx
src/preview/preview.test.tsx
src/preview/protocol.ts
src/serve.ts
src/viewer/Fence.tsx
src/viewer/ReviewedCheckbox.tsx
src/viewer/SourceDiffPanel.tsx
src/viewer/previews/PreviewBlock.tsx
src/viewer/previews/config.ts
src/viewer/previews/previews.test.ts
src/viewer/previews/reviewedStates.ts
```
