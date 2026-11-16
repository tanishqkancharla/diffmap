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

[[39c48f0:src/parseFence.ts#L124-L133]] parses it, and `validate` rejects a fence with no stories or a line that is not a story ID ([[39c48f0:src/parseViewer.ts#L127-L139]]).

`serve` answers `/__diffmap/config` with the repo's `.diffmap/config.json`, found by walking up from the spec and checked for its shape ([[39c48f0:src/diffmapConfig.ts#L26-L78]], [[39c48f0:src/serve.ts#L301-L312]]). A file with a wrong setting is reported in the block with the file's path, rather than ignored.

```callstack [Showing a preview fence]
 view = Fence(fence) [[39c48f0:src/viewer/Fence.tsx#L64-L67]]
+└── return PreviewBlock(fence) [[85f7ba9:src/viewer/previews/PreviewBlock.tsx#L12-L91]]
+    ├── page = usePreviewPage(): previews.local, or why there is none [[85f7ba9:src/viewer/previews/PreviewBlock.tsx#L94-L121]]
+    └── fence.stories.map((id) => PreviewFrame(page, [id])) [[39c48f0:src/viewer/previews/PreviewFrame.tsx#L49-L260]]
+        ├── iframe(page + "?story=" + id), loaded once it nears the viewport
+        ├── post preview-connect on load and on preview-hello
+        ├── preview-ready: the catalog, for the story's name and description
+        ├── preview-size: the frame grows to the story's height
+        ├── preview-state: the story's fingerprint, which a flow keys its review marks to
+        └── no ready within 8 seconds: say the page is unreachable, with Retry
```

The frames sit in a grid that puts them side by side when they fit the column and wraps them when they do not. Above each frame is the story's name, and under it is the story's description. A preview block has nothing to review: it shows a component, so review marks belong to a flow's states in [Phase 3](03-flow-block.md).

**When there is no page to show.** On a pull request on diffmap.dev, the block loads the pull request's preview deployment ([Phase 6](06-diffmap-dev-and-guide.md)). Anywhere else outside `serve`, such as a shared gist, it says live previews show when the spec runs with `diffmap serve`. Without `previews.local`, it says what to add to `.diffmap/config.json`. When the dev server is not running, each frame says it cannot reach the page at its URL, with a Retry button.

**Keeping the reader's place.** A story's `play` focuses inputs as it types, and focusing inside a frame makes the browser scroll the page to that frame and move keyboard focus into it. The page replays steps with `preventScroll` ([[39c48f0:src/preview/PreviewRoute.tsx#L369-L380]]), and the viewer hands focus back when a frame takes it before it has shown its state ([[39c48f0:src/viewer/previews/PreviewFrame.tsx#L170-L183]]). A reader who clicks into a live frame keeps focus there.

The iframe is sandboxed with `allow-scripts allow-same-origin`. That pair would let a same-origin frame lift its own sandbox, but the app always runs at its own origin, apart from the viewer's, and its fake server is a service worker, which needs an origin to register.

Checked in Chrome against [`fixtures/previews-app`](07-examples.md): four button and alert stories side by side, each with its name and description; and with the dev server stopped, every frame's unreachable message, then Retry connecting once the server was back.

```changes
a5ec180..85f7ba9
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
src/preview/PreviewRoute.tsx
src/preview/protocol.ts
src/viewer/previews/FlowBlock.tsx
src/viewer/previews/flowTree.ts
```
