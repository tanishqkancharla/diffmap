# Phase 4: Previews and HTML

[Phase 1](02-share-dialog.md) shares everything the viewer draws itself. This phase adds the two things that run the spec's own code: the preview and flow blocks from [pull request #40](https://github.com/tanishqkancharla/diffmap/pull/40), and HTML the spec includes. Both are uploaded with the spec, so they keep working after the sharing machine shuts down, and both run on `<id>.diffmapusercontent.com`, the separate domain from [Where it runs](01-where-it-runs.md#security). This phase lands after #40.

**Today**

#40's blocks load the app's preview page from `previews.local` in `.diffmap/config.json`: a URL on the app's dev server, running on the same machine as `serve`. A shared spec can only show them while that machine and its dev server are up and reachable, which a reader's browser usually cannot do. On every hosted viewer, [[src/viewer/Fence.tsx#Fence]] and [[src/viewer/ComarkView.tsx#ComarkView]] show a placeholder instead of HTML.

**Proposed**

A shared spec shows live UI and HTML blocks as `serve` does, with nothing running on the sharing machine. A reviewer can click through a flow, watch the loading state, and see the error arrive. If the repo cannot build its preview page, the blocks show a screenshot of each state instead, still with the flow's breadcrumbs and tree, and a note that the live version needs a preview build.

## Live UI: built and uploaded

The preview page is a small part of the app: the app's components, styles, and fake server, rendered by Storybook's library. Built as static files, it runs anywhere, so sharing builds it and uploads it with the spec:

```json [.diffmap/config.json]
{
  "previews": {
    "local": "http://localhost:5173/previews.html",
    "build": { "command": "vite build --config vite.previews.config.ts", "dir": "dist-previews" }
  }
}
// [!note L4] New in this phase: how to build the preview page as static files.
```

When a spec has preview or flow blocks, sharing runs `build.command`, then uploads `build.dir` as part of the version, and the blocks load `https://<id>.diffmapusercontent.com/v<n>/previews/previews.html`. The build uses relative paths (`base: "./"` in Vite) and includes MSW's `mockServiceWorker.js`, so the stories' fake server works from static files. Only files that changed since the last version upload. With [live updates](04-live-link.md) on, `serve` rebuilds when a story or component file changes, at most once every 30 seconds, since a build takes longer than a page edit. The share dialog shows "Building previews…" while it runs.

The protocol from #40 already fits. The viewer takes the frame's origin from the page URL ([`PreviewFrame.tsx`](https://github.com/tanishqkancharla/diffmap/blob/cursor/flow-preview-spec-d9f7/src/viewer/previews/PreviewFrame.tsx)), and the preview page accepts messages from diffmap.dev (`isViewerOrigin` in `src/preview/protocol.ts`). The Worker sends `frame-ancestors` itself, so the app needs no header for its uploaded build.

## The fallback: screenshots

Without `build`, or when the build fails, sharing captures each state instead. `serve` already has the live preview page running locally, so it opens each story and each flow state in a headless browser, replays the state's path as the flow block does, and saves a screenshot at the size the block draws. The version's manifest holds them as `previews.screenshots`, and the blocks draw the same controls around still images. Capturing needs a headless Chromium, which `share` installs on first use; if none is available, the dialog says the previews will show as placeholders and how to fix it.

## HTML

Sharing uploads each HTML fence and each block of raw HTML as its own file. The shared viewer draws it in a frame from `https://<id>.diffmapusercontent.com/v<n>/html/<sha256>`, which the Worker wraps in a page with the viewer's fonts and colors and a small script that reports its height, so the frame grows to fit, as the block does locally. Raw HTML inside a sentence cannot be a frame, so it shows as text.

## Keeping uploaded code contained

A built preview page is the app's real code, so it runs under these rules:

- **Its own site per spec.** Each spec's subdomain is its own origin, so its service worker, storage, and cookies are apart from every other spec's. Each version sits under its own path (`/v<n>/`), so a new version's service worker never serves an old one's files.
- **No real backend.** Preview pages get `connect-src 'self'`, so any request the stories' fake server does not answer fails instead of reaching a real API from the reader's browser. A story that mocks another origin's URLs lists that origin in `previews.connect`.
- **Only inside diffmap.dev.** The Worker answers usercontent pages only for frames of diffmap.dev, so an uploaded page cannot be used as a standalone phishing site.
- **Restricted specs stay restricted.** Frames of a Restricted spec need the signed link and cookie from [Phase 2](03-restricted-and-invites.md#previews-and-html-in-restricted-specs).
- **Counted in the limits.** The built directory counts toward the 200 MB per version, and sharing names the largest files when it is over.

## The guide

[[guide.md]]'s live previews section, added by #40, says to add `previews.build` so shared specs show live UI, with Vite and Next.js recipes for a static preview build.

```changes

```
