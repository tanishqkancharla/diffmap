# Phase 5: Previews and HTML

Live UI and HTML blocks work on a shared link, with nothing running on the sharing machine.

**Today:** preview blocks load a dev server on the sharing machine or a pull request's preview deployment ([[src/diffmapConfig.ts#deploymentUrl]]). Hosted viewers show placeholders for HTML ([[src/viewer/Fence.tsx#Fence]]).

**Proposed**

```json [.diffmap/config.json]
{
  "previews": {
    "local": "http://localhost:5173/previews.html",
    "build": {
      "command": "vite build --config vite.previews.config.ts",
      "dir": "dist-previews"
    }
  }
}
// [!note L4] New: how to build the preview page as static files.
```

- `publish` runs the build and uploads its changed files with the version.
- Without a build, `publish` screenshots each story and flow state in headless Chromium instead.
- HTML blocks render in frames sized to their content.
- Everything runs on `<id>.productdocusercontent.com`:
  - Each document is its own origin, and each version has its own path.
  - Pages only load inside productdoc.dev frames.
  - `connect-src 'self'`, so stories can't reach real APIs.
  - Restricted documents use signed links and `Partitioned` cookies.
- `https://productdoc.dev` joins [[src/preview/protocol.ts#isViewerOrigin]].
- **Open question:** instead of `previews.build`, keep standalone stories in the document folder that import the real components, and have productdoc bundle them itself.

## Todos

- [ ] `previews.build` in the config, checked by `validate`
- [ ] Build and upload in `publish`
- [ ] The usercontent Worker and its headers
- [ ] Add productdoc.dev to `isViewerOrigin` and `frame-ancestors`
- [ ] Screenshot fallback
- [ ] HTML in frames
- [ ] Signed frame links for Restricted documents
- [ ] productdocusercontent.com on the Public Suffix List
- [ ] Guide: Vite and Next.js recipes

```changes

```
