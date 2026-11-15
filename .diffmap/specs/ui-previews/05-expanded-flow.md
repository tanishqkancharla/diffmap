# Phase 5: Expand a flow to the full canvas

[Phase 3](03-flow-block.md) and [Phase 4](04-live-transitions.md) built the inline flow block. This phase adds its expanded view.

**Today**

Diagrams and images expand into a full-window `Dialog` that draws a second copy of the content ([[src/viewer/MermaidBlock.tsx#MermaidBlock]]).

**Proposed**

The expand button, or Enter while the block has focus, opens flow-preview's full layout over the page: the outline, a pannable and zoomable map of thumbnails joined by their actions, and the live preview with breadcrumbs. Escape, the close button, or a click outside it collapses it to the same state.

A second copy would reload the app and lose what the reader typed, and moving an iframe to a new place in the page reloads it too. So the live frame stays where it is. Expanding fixes its frame to the window over a scrim, traps focus, and lays the outline and map out around it. The map's layout, sidebar resizing, and selection styling come from flow-preview's canvas in `src/viewer/flow/`.

Inline, the frame takes the text column's width. Expanded, it renders at `flows.viewport` from `.diffmap/config.json`, scaled down to fit the window when the window is smaller, so a desktop layout shows as it does at full width. Without the setting, the frame fills the space the outline and map leave.

```changes

```
