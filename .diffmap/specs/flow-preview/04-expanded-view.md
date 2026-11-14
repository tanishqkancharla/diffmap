# Phase 4: Expand to the full canvas

[Phase 2](02-inline-widget.md) and [Phase 3](03-live-transitions.md) built the inline widget. This phase adds the expanded view.

**Today**

Diagrams and images expand into a full-window `Dialog` that draws a second copy of the content ([[src/viewer/MermaidBlock.tsx#MermaidBlock]]).

**Proposed**

The expand button, or Enter while the widget has focus, opens flow-preview's full layout over the page: the outline, a pannable and zoomable map of thumbnails joined by their actions, and the live preview with breadcrumbs. Escape, the close button, or a click outside it collapses it to the same state.

A second copy would reload the app and lose what the reader typed, and moving an iframe to a new place in the page reloads it too. So the live iframe stays where it is. Expanding fixes its frame to the window over a scrim, traps focus, and lays the outline and map out around it. The map's layout, sidebar resizing, and selection styling come from flow-preview's canvas, which moves into `src/viewer/flow/` without the parts that rendered states: those now come from the route.

```changes

```
