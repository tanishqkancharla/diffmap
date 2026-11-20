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

## Expected flows

**A reader clicks through a flow**

1. You publish a document with a flow block, then shut your laptop.
2. A reader opens the link and steps through the flow: they type, click, and watch the loading and error states, as you do locally.
3. Nothing they do reaches your real backend.

**The repo can't build its previews**

1. You publish from a repo with no preview build.
2. Readers see a screenshot of each state. They can still step through the flow, but not click inside it.
3. A note says the live version needs a preview build.

**An agent sets up the preview build**

1. Publishing tells your agent the previews will be screenshots, and how to fix it.
2. The agent adds the build, and publishes again. Readers get live UI.

**A component changes after sharing**

1. You change a component a story uses, and publish.
2. Readers see the new version in the preview. The older version's link still shows the old UI.

**HTML in a document**

1. A page includes an HTML block, such as a chart.
2. Readers see it rendered, sized to fit, as it is locally.

**A Restricted document with previews**

1. Ada opens a Restricted document that has a flow block.
2. The flow works for her. If she copies the preview's frame address and sends it to someone else, it doesn't open for them.

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
