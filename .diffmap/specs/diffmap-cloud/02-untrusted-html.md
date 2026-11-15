# Phase 1: Untrusted specs cannot act as the reader

[What cloud could mean](01-what-cloud-could-mean.md) recommends signing readers in on diffmap.dev. Once the site holds a reader's GitHub token, any script that runs on diffmap.dev can use it. diffmap.dev opens specs from any public pull request, written by anyone, so this phase makes sure a spec cannot run script there before [Phase 2](03-sign-in-with-github.md) adds the token.

**Today**

Most of this already holds. On diffmap.dev, [[src/viewer/ComarkView.tsx#ComarkView]] and [[src/viewer/Fence.tsx#Fence]] only render HTML when `useViewerMode()` is `"local"`, and show a placeholder otherwise. Elements from Markdown pass only an allowlist of attributes ([[src/viewer/ComarkView.tsx#domAttrs]]), so no `on*` handler gets through, and React 19 refuses `javascript:` URLs in `href` and `src`. Mermaid runs at its default `strict` security level.

Two gaps remain. `renderElement` passes any tag name the parser produces to `createElement`, so a spec can create an `iframe` or `form`. And diffmap.dev sends no `Content-Security-Policy`, so a future rendering bug would run script with nothing to stop it.

**Proposed**

A reader sees no difference. The hosted site refuses anything a spec could use to run script or send the reader's requests elsewhere.

- `renderElement` renders only the tags Markdown and diffmap's own components produce, and shows any other tag's text as plain text.
- `vercel.json` sends a `Content-Security-Policy` header on every route.

```json [vercel.json, added]
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      {
        "key": "Content-Security-Policy",
        "value": "default-src 'self'; script-src 'self' 'sha256-<theme script>'; connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://gist.githubusercontent.com <telemetry host>; img-src 'self' https: data:; media-src 'self' https:; frame-src <preview origins>; frame-ancestors 'none'; form-action 'self'"
      }
    ]
  }
]
```

`'sha256-…'` allows only the theme script that `index.html` runs before the page loads. `frame-ancestors 'none'` stops other sites framing diffmap.dev to trick a signed-in reader into clicking **Send review**. `frame-src` lists the preview origins that [pull request #40](https://github.com/tanishqkancharla/diffmap/pull/40)'s blocks load; with previews coming from any repo's config, it may need to be `https:`, which is safe because the frames run on other origins.

The local `serve` keeps trusting HTML: the spec there is the developer's own, and it already sends its own policy with a nonce ([[src/serve.ts]]).

```changes

```
