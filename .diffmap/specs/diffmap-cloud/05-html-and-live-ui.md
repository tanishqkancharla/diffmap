# Phase 4: HTML and live UI

[Phase 1](02-publish-a-spec.md) shares everything the viewer draws itself. This phase adds the two things that run the spec's own code: HTML the spec includes, and the preview and flow blocks from [pull request #40](https://github.com/tanishqkancharla/diffmap/pull/40). Both run on `<id>.diffmapusercontent.com`, the separate domain set up in [Where it runs](01-where-it-runs.md#security). This phase lands after #40.

**Today**

On every hosted viewer, [[src/viewer/Fence.tsx#Fence]] and [[src/viewer/ComarkView.tsx#ComarkView]] show a placeholder instead of HTML, because script in it would run on diffmap.dev. #40's blocks load the app's preview page from `previews.local` in `.diffmap/config.json`, a URL on the developer's dev server, so a shared spec has nothing to load.

**Proposed**

A shared spec shows HTML blocks and live UI as `serve` does. A reviewer can click through a flow, watch the loading state, and see the error arrive, with nothing running on their machine.

## HTML

`share` uploads each HTML fence and each block of raw HTML as its own blob. The published viewer draws it in a frame from `https://<id>.diffmapusercontent.com/v<n>/html/<sha256>`, which the Worker wraps in a page with the viewer's fonts and colors and a small script that reports its height, so the frame grows to fit, as the block does locally. Raw HTML inside a sentence cannot be a frame, so it shows as text.

## Live UI

The preview page needs the app's own components, styles, and fake server. A shared spec gets it one of two ways, both set in `.diffmap/config.json`:

```json [.diffmap/config.json]
{
  "previews": {
    "local": "http://localhost:5173/previews.html",
    "build": { "command": "vite build --config vite.previews.config.ts", "dir": "dist-previews" },
    "preview": "https://acme-git-{branch}.vercel.app/previews.html"
  }
}
// [!note L4] New in this phase: how to build the preview page as static files.
// [!note L5] From #40's Phase 6: the app's own preview deployment.
```

- **`build`, uploaded by `share`.** `share` runs the command, then uploads the directory as part of the version, and blocks load `https://<id>.diffmapusercontent.com/v<n>/previews/previews.html`. The page must work as static files, so its build uses relative paths (`base: "./"` in Vite) and includes MSW's `mockServiceWorker.js`. Only the files that changed since the last version upload, so sharing again after a one-line fix is quick.
- **`preview`, the app's own deployment.** If there is no `build`, blocks load this URL, as #40's Phase 6 plans for pull requests. It only works while that deployment is public and allows diffmap.dev to frame it.

If neither is set, the block says the preview needs the app's preview page and how to add `build`, as #40's blocks do when the dev server is not running.

The protocol from #40 already fits. The viewer takes the frame's origin from the page URL ([`PreviewFrame.tsx`](https://github.com/tanishqkancharla/diffmap/blob/cursor/flow-preview-spec-d9f7/src/viewer/previews/PreviewFrame.tsx)), and the preview page accepts messages from diffmap.dev (`isViewerOrigin` in `src/preview/protocol.ts`). The Worker sends `frame-ancestors` itself, so the app needs no header for its uploaded build.

## Keeping uploaded previews contained

A built preview page is the app's real code, so it runs under these rules:

- **Its own site per spec.** Each spec's subdomain is its own origin, so its service worker, storage, and cookies are apart from every other spec's. Each version sits under its own path (`/v<n>/`), so a new version's service worker never serves an old one's files.
- **No real backend.** Preview pages get `connect-src 'self'`, so any request a story's fake server does not answer fails instead of reaching a real API with the reader's network. A story that mocks another origin's URLs lists that origin in `previews.connect`.
- **Only inside diffmap.dev.** The Worker answers preview files only for frames of diffmap.dev, as for HTML, so an uploaded page cannot be used as a standalone phishing site.
- **Counted in the limits.** The built directory counts toward the 200 MB per version, and `share` names the largest files when it is over.

## The guide

[[guide.md]]'s live previews section, added by #40, says to add `previews.build` so shared specs show live UI, with the Vite and Next.js recipes for a static preview build.

```changes

```
