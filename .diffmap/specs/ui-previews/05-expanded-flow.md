# ✅ Phase 5: Expand a flow to the full canvas

[Phase 3](03-flow-block.md) and [Phase 4](04-live-transitions.md) built the inline flow block. This phase adds its expanded view.

**Today**

Diagrams and images expand into a full-window `Dialog` that draws a second copy of the content ([[src/viewer/MermaidBlock.tsx#MermaidBlock]]).

**Proposed**

The expand button opens the flow over the page as two parts: the live screen, and the tree of states drawn as thumbnails. The inline block's text tree is left out, since the thumbnail tree answers the same question with pictures. The header's breadcrumbs still say where the reader is.

A second copy would reload the app and lose what the reader typed, and moving an iframe to a new place in the page reloads it too. So nothing moves: the block's own card becomes a fixed panel over a scrim, and the tree of states takes the place of the text tree beside the live frame. React keeps every frame in the same position in the tree, so none of them reload. The block's height is held in the page while it is expanded, so the text below does not jump, and the page behind it stops scrolling.

- **The tree** lays the states out left to right, each state to the right of the one it follows and centered on its own children ([[d982acf:src/viewer/previews/flowTree.ts#L41-L62]]). Each card is the app rendered at 720 pixels wide and scaled down, inert, captioned with the action that reaches it, and clicking it jumps to that state. Curved edges join the cards, and the path to the selected state is drawn in the accent color. Each card has its own Reviewed checkbox in its corner; a reviewed card fades and shows a green check circle, as flow-preview's canvas does, and the live screen never shows it. The tree scrolls to center the selected state as the reader moves ([[e45db07:src/viewer/previews/FlowBlock.tsx#L117-L131]]). Its thumbnails load only while the flow is expanded.
- **The live screen** renders at `flows.viewport` from `.diffmap/config.json`, scaled down to fit its column, so a desktop layout shows as it does at full width. Without the setting, it takes the column's width.

Checked in Chrome at 1440 by 900: the log-in flow expanded, played "Fill in email and password", "Log in", and "Enter the code" on the live screen without reloading it, highlighted that path in the tree, and collapsed with Escape to the same state. The checkout flow expanded on its `Declined` state shows the live payment screen at 1024 by 720 beside the tree.

```changes
2df4c53..e45db07
src/viewer/previews/FlowBlock.tsx
src/viewer/previews/flowTree.ts
src/viewer/previews/PreviewFrame.tsx
```
