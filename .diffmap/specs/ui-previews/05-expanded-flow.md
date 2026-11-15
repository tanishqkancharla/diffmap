# ✅ Phase 5: Expand a flow to the full canvas

[Phase 3](03-flow-block.md) and [Phase 4](04-live-transitions.md) built the inline flow block. This phase adds its expanded view.

**Today**

Diagrams and images expand into a full-window `Dialog` that draws a second copy of the content ([[src/viewer/MermaidBlock.tsx#MermaidBlock]]).

**Proposed**

The expand button opens the flow over the page as two parts: the states on the left and the live screen beside them. Each part answers one question. The header's breadcrumbs say where the reader is, the live screen shows what it looks like, and the states show where the reader can go and what is left to review. flow-preview also lists every state in an outline, but that answers the same question as the states, so the expanded view leaves it out. Escape, the close button, or a click on the scrim collapses it to the same state.

A second copy would reload the app and lose what the reader typed, and moving an iframe to a new place in the page reloads it too. So nothing moves: the block's own card becomes a fixed panel over a scrim, and the states are shown beside the live frame, whether or not "Show all states" was open. React keeps every frame in the same position in the tree, so none of them reload. The block's height is held in the page while it is expanded, so the text below does not jump, and the page behind it stops scrolling.

- **The states** keep the sequence or tree switch from the inline block. The panel is two cards wide. The sequence runs down it as one column. The tree snaps a column at a time and puts the selected state in the first column, so its next steps show beside it ([[c5df8c8:src/viewer/previews/FlowBlock.tsx#L120-L141]]). The tree lays out each state to the right of the one it follows and centered on its own children ([[d982acf:src/viewer/previews/flowTree.ts#L41-L62]]).
- **The live screen** renders at `flows.viewport` from `.diffmap/config.json`, scaled down to fit its column, so a desktop layout shows as it does at full width. Without the setting, it takes the column's width.

Checked in Chrome at 1440 by 900: the log-in flow expanded, played "Fill in email and password", "Log in", and "Enter the code" on the live screen without reloading it, highlighted that path in the states, and collapsed with Escape to the same state. The checkout flow expanded on its `Declined` state shows the states and the live payment screen at 1024 by 720.

```changes
2df4c53..c5df8c8
src/viewer/previews/FlowBlock.tsx
src/viewer/previews/flowTree.ts
src/viewer/previews/PreviewFrame.tsx
```
