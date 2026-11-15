# ✅ Phase 2: The `preview` block

[Phase 1](01-preview-route.md) gave the app a page that renders any story. This phase shows stories in a spec: a component on its own, or several variants side by side.

**Today**

A spec shows UI as screenshots in a gallery ([[src/viewer/Media.tsx]]).

**Proposed**

A `preview` fence lists one or more story IDs, one per line, with an optional title:

````text
```preview [Buttons and alerts]
design-button--primary
design-button--secondary
design-button--pending
design-button--alerts
```
````

[[f914dad:src/parseFence.ts#L124-L133]] parses it, and `validate` rejects a fence with no stories or a line that is not a story ID ([[f914dad:src/parseViewer.ts#L127-L139]]).

`serve` answers `/__diffmap/config` with the repo's `.diffmap/config.json`, found by walking up from the spec and checked for its shape ([[f914dad:src/diffmapConfig.ts#L26-L78]], [[f914dad:src/serve.ts#L301-L312]]). A file with a wrong setting is reported in the block with the file's path, rather than ignored.

```callstack [Showing a preview fence]
 view = Fence(fence) [[f914dad:src/viewer/Fence.tsx#L64-L67]]
+└── return PreviewBlock(fence) [[4266595:src/viewer/previews/PreviewBlock.tsx#L12-L91]]
+    ├── page = usePreviewPage(): previews.local, or why there is none [[4266595:src/viewer/previews/PreviewBlock.tsx#L94-L121]]
+    └── fence.stories.map((id) => PreviewFrame(page, [id])) [[f914dad:src/viewer/previews/PreviewFrame.tsx#L49-L260]]
+        ├── iframe(page + "?story=" + id), loaded once it nears the viewport
+        ├── post preview-connect on load and on preview-hello
+        ├── preview-ready: the catalog, for the story's name and description
+        ├── preview-size: the frame grows to the story's height
+        ├── preview-state: the story's fingerprint, for its review mark
+        └── no ready within 8 seconds: say the page is unreachable, with Retry
```

The frames sit in a grid that puts them side by side when they fit the column and wraps them when they do not. Under each frame are the story's name, a **Reviewed** checkbox, and its description. Review marks are stored in `localStorage` per spec page, keyed to the story's fingerprint, as [[src/viewer/reviewed.ts#useReviewedFiles]] keys reviewed files to their diff, so a story whose UI changes needs reviewing again ([[f914dad:src/viewer/previews/reviewedStates.ts#L45-L63]]).

**When there is no page to show.** Outside `serve`, the block says live previews show when the spec runs with `diffmap serve`; [Phase 6](06-diffmap-dev-and-guide.md) adds the pull request's deployment. Without `previews.local`, it says what to add to `.diffmap/config.json`. When the dev server is not running, each frame says it cannot reach the page at its URL, with a Retry button.

**Keeping the reader's place.** A story's `play` focuses inputs as it types, and focusing inside a frame makes the browser scroll the page to that frame and move keyboard focus into it. The page replays steps with `preventScroll` ([[f914dad:src/preview/PreviewRoute.tsx#L369-L380]]), and the viewer hands focus back when a frame takes it before it has shown its state ([[f914dad:src/viewer/previews/PreviewFrame.tsx#L170-L183]]). A reader who clicks into a live frame keeps focus there.

The iframe is sandboxed with `allow-scripts allow-same-origin`. That pair would let a same-origin frame lift its own sandbox, but the app always runs at its own origin, apart from the viewer's, and its fake server is a service worker, which needs an origin to register.

Checked in Chrome against [`fixtures/previews-app`](07-examples.md): four button and alert stories side by side, each with its name, description, and review mark; and with the dev server stopped, every frame's unreachable message, then Retry connecting once the server was back.

```changes
e7b0bd1..4266595
src/parseFence.ts
src/parseViewer.ts
src/diffmapConfig.ts
src/serve.ts
src/viewer/Fence.tsx
src/viewer/previews/PreviewBlock.tsx
src/viewer/previews/PreviewFrame.tsx
src/viewer/previews/config.ts
src/viewer/previews/reviewedStates.ts
src/viewer/previews/previews.test.ts

ignore:
package.json
src/preview/preview.test.tsx
```
