# ✅ Phase 5: Expand a flow to the full canvas

[Phase 3](03-flow-block.md) and [Phase 4](04-live-transitions.md) built the inline flow block. This phase adds its expanded view.

**Today**

Diagrams and images expand into a full-window `Dialog` that draws a second copy of the content ([[src/viewer/MermaidBlock.tsx#MermaidBlock]]).

**Proposed**

The expand button opens flow-preview's full layout over the page: the outline of every state, the live screen, and a map of thumbnails joined by their actions. Escape, the close button, or a click on the scrim collapses it to the same state.

A second copy would reload the app and lose what the reader typed, and moving an iframe to a new place in the page reloads it too. So nothing moves: the block's own card becomes a fixed panel over a scrim, the outline is added beside the live frame, and the tree of states is shown beside it as the map, whether or not "Show all states" was open. React keeps every frame in the same position in the tree, so none of them reload. The block's height is held in the page while it is expanded, so the text below does not jump, and the page behind it stops scrolling.

- **The outline** lists every state indented by depth, with its action and a check when it has been reviewed.
- **The live screen** renders at `flows.viewport` from `.diffmap/config.json`, scaled down to fit its column, so a desktop layout shows as it does at full width. Without the setting, it takes the column's width.
- **The map** lays the tree out left to right, each state to the right of the one it follows and centered on its own children ([[f914dad:src/viewer/previews/flowTree.ts#L41-L62]]). Curved edges join the cards, and the path to the selected state is drawn in the accent color. The map scrolls to the selected state as the reader moves.

Checked in Chrome at 1440 by 900: the log-in flow expanded, played "Fill in email and password", "Log in", and "Enter the code" on the live screen without reloading it, highlighted that path on the map, and collapsed with Escape to the same state. The checkout flow expanded on its `Declined` state shows the outline, the live payment screen at 1024 by 720, and the map.

```changes
e7b0bd1..4266595
src/viewer/previews/FlowBlock.tsx
src/viewer/previews/flowTree.ts
src/viewer/previews/PreviewFrame.tsx
```
