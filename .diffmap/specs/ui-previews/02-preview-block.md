# Phase 2: The `preview` block

[Phase 1](01-preview-route.md) gave the app a page that renders any story. This phase shows stories in a spec: a component on its own, or several variants side by side.

**Today**

A spec shows UI as screenshots in a gallery ([[src/viewer/Media.tsx]]).

**Proposed**

A `preview` fence lists one or more story IDs, one per line, with an optional title:

````text
```preview [The digest name field]
settings-preferences--editing
settings-preferences--empty-name
```
````

The viewer reads `previews` from `.diffmap/config.json` and loads `<previews.local>?story=<id>` in one iframe per story. Each frame connects as Phase 1 describes. The block lays the frames out side by side when they fit the column and stacks them when they do not, with each story's name and description under its frame, drawn by the viewer with Maui, as the other fences do.

```callstack [Showing a preview fence]
 view = Fence(fence) [[src/viewer/Fence.tsx#Fence]]
+└── return PreviewBlock(fence)
+    ├── url = previewUrl(config, viewerMode) # local, or the PR's preview
+    ├── frames = fence.stories.map((id) => PreviewFrame(url, id))
+    │   ├── iframe(url + "?story=" + id), lazy until near the viewport
+    │   ├── post preview-connect # on load, and on preview-hello
+    │   ├── await preview-ready, or preview-error: show its message
+    │   └── on preview-size: grow up to a height cap, then scroll
+    └── expand: one frame at the window's size, as images expand today
```

`PreviewBlock`, `PreviewFrame`, and `previewUrl` are planned names. [[src/parseFence.ts#parseFence]] learns the `preview` kind, whose body is one story ID per line. `PreviewFrame` is shared with the flow block in [Phase 3](03-flow-block.md).

- **Review marks** sit under each frame and are stored in `localStorage` per spec and story, keyed to the story's `fingerprint`, the same way [[src/viewer/reviewed.ts#useReviewedFiles]] keys reviewed files to their diff. A story whose UI changes needs reviewing again.
- **When the page cannot be reached,** the block says so in place, with the URL it tried, such as "Start your dev server at http://localhost:5173". `serve` adds the same message to its `warnings`.
- **An unknown story ID** shows the page's `preview-error` in that frame, and the block lists the IDs it does know.

The local viewer's content security policy ([[src/serve.ts#contentSecurityPolicy]]) only restricts scripts, objects, and the base URL, so it does not block the frames. `validate` checks that each `preview` fence lists at least one ID and that `.diffmap/config.json` has a `previews` key; it does not reach the app.

```changes

```
