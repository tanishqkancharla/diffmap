# ✅ Phase 1: The `/__previews` page

The [cover](README.md) describes the `preview` and `flow` blocks and why the app renders its own stories. Nothing in diffmap knew about stories before this phase. It gives an app a page that renders any of its stories, and the messages diffmap will use to drive it.

**Today**

To preview UI, an agent takes screenshots, or builds a separate app in `tmp/` and recreates the project's styles and providers inside it.

**Proposed**

The package gains a small entry point, `@tanishqkancharla/diffmap/preview`, next to the `.` export in [[eb505dc:package.json]]. It exports a `PreviewRoute` component and `previewFrameAncestors`, from [[eb505dc:src/preview/index.ts]]. `@storybook/react` and React are optional peer dependencies, so installing diffmap for its CLI pulls in neither, and the page uses the app's own copy of `@storybook/react`, the same version as its Storybook.

The app mounts `PreviewRoute` on a dev-only page. For a Vite app, it is an extra `previews.html` entry that Vite serves in dev and that the production build leaves out. The page applies the project's Storybook preview, as Storybook's own Vitest setup does, so every story gets the app's decorators, providers, and global styles:

```tsx [src/previews/main.tsx]
import { createRoot } from "react-dom/client";
import { setProjectAnnotations } from "@storybook/react";
import { PreviewRoute } from "@tanishqkancharla/diffmap/preview";
import preview from "../../.storybook/preview";

setProjectAnnotations([preview]);
const stories = import.meta.glob("../**/*.stories.tsx", { eager: true });

createRoot(document.getElementById("root")!).render(
  <PreviewRoute stories={stories} />,
);
```

A page cannot set its own `frame-ancestors`, so the dev server sends it. `previewFrameAncestors` allows `'self'`, the local viewer on `127.0.0.1` or `localhost` on any port, and `https://www.diffmap.dev`:

```ts [vite.config.ts]
import { previewFrameAncestors } from "@tanishqkancharla/diffmap/preview";

export default defineConfig({
  server: { headers: { "Content-Security-Policy": previewFrameAncestors } },
});
```

In a Next.js app, it is an `app/__previews/page.tsx` that returns `notFound()` in production, with the same header set for that path in `next.config`. The guide carries both recipes.

`PreviewRoute` composes every story module with Storybook's `composeStories`. It renders the story named by `?story=`, using the story's Storybook ID, such as `settings-preferences--saved`. Showing a story follows Storybook's own order: load it, which runs its loaders and `beforeEach`; render it; then run its `play` function, so a story defined by interactions reaches its state. Without `?story=`, the page lists every story by title and links to each. A mistake in a story file shows as a list the agent can fix from: a file without a default export, a file without a `title`, two stories with one ID, or a `play` function that throws.

```callstack [Showing a story]
PreviewRoute({ stories }) [[eb505dc:src/preview/PreviewRoute.tsx#L34-L201]]
├── resolveStories(stories, composeStories): catalog by ID, and problems [[eb505dc:src/preview/protocol.ts#L108-L152]]
├── read ?story=
└── show(id) [[eb505dc:src/preview/PreviewRoute.tsx#L79-L103]]
    ├── await story.load() # loaders and beforeEach
    ├── PreviewView: <Story /> in a fresh container, decorators and args applied [[eb505dc:src/preview/PreviewRoute.tsx#L203-L249]]
    └── after it renders [[eb505dc:src/preview/PreviewRoute.tsx#L110-L137]]
        ├── await story.play?.({ canvasElement })
        ├── watch the container's size
        └── post preview-state, or preview-error if play threw
```

Inside a block, it talks to the viewer with `postMessage`. The page cannot know who framed it, and the viewer's first message can arrive before React mounts the listener. So the page first says hello to its parent, with nothing in the message, and sends its catalog only to a viewer origin that answers with `preview-connect`. The viewer also sends `preview-connect` when the iframe loads, so either order connects:

```ts
// page → viewer
{ type: "preview-hello", protocol: 1 } // to any parent, once the page listens
{ type: "preview-ready", protocol: 1, stories: [{ id, title, name, description, hasPlay }] }
{ type: "preview-size", width, height } // whenever the story's box resizes
{ type: "preview-state", story, fingerprint } // after each story renders and plays
{ type: "preview-error", message } // an unknown story, or a play function that threw
// viewer → page
{ type: "preview-connect" }
{ type: "preview-show", story, how: "render" | "play" }
{ type: "preview-mode", mode: "live" | "thumbnail" }
// [!note description] The story's parameters.docs.description.story, which Storybook's docs also show.
// [!note fingerprint] A hash of the story's rendered HTML and classes, used for review marks.
// [!note how] "play" runs the story's play function on the UI already showing; Phase 4 adds it.
```

```callstack [Driven by the viewer]
onMessage(event) [[eb505dc:src/preview/PreviewRoute.tsx#L140-L169]]
├── ignore it unless event.source is the parent and isViewerOrigin(event.origin) [[eb505dc:src/preview/protocol.ts#L32-L44]]
├── parseViewerMessage(event.data) [[eb505dc:src/preview/protocol.ts#L50-L72]]
├── preview-connect: remember the origin, then post preview-ready, preview-size, and preview-state
├── other messages only from the remembered origin
├── preview-show → show(story); an unknown story posts preview-error
└── preview-mode → document.documentElement.dataset.previewMode
```

Each `preview-state` carries a fingerprint of the story's HTML ([[eb505dc:src/preview/protocol.ts#L75-L82]]), and neither it nor `preview-size` repeats an unchanged report. The page passes Storybook's `composeStories` into `resolveStories`, so the tests compose real story modules with the real library.

Checked in Chrome with a Vite app that mounts the page as above, with a Storybook preview whose decorator wraps every story, framed by a page on another allowed origin. On connect, the page sent its hello, then the catalog with each story's description and whether it has a `play` function, then its size and the `Editing` story. Showing `Saved` ran its `play`, which clicked the real Save button, and the confirmation appeared inside the decorator. Showing `EmptyName` ran its `play`, which cleared the field, and the validation message appeared. An unknown story answered with `preview-error`, and `preview-mode` set the attribute.

```changes
eb505dc
src/preview/index.ts
src/preview/PreviewRoute.tsx
src/preview/protocol.ts
src/preview/preview.test.tsx
package.json

ignore:
package-lock.json
tsconfig.build.json
```
