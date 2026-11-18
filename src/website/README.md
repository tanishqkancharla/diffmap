# Productdoc website

This work does not deploy the website, change DNS, approve npm releases, or enable analytics. The source-thread runtime/release files are deliberately not included. Productdoc is the successor to Diffmap, not a permanent parallel runtime.

## Local review

```sh
npm run build:gist
amp orb service start productdoc-website --command 'node --import tsx src/website/server.ts' --portal
```

The Vite build keeps the existing shared viewer in `dist/viewer.html`, and generates public pages plus Markdown twins from `content.ts` and `examples.ts`. `gist/website.html` is the website entry; `gist/index.html` remains the shared viewer entry. Website HTML uses semantic native elements because the installed Maui/Purse provider requires `document` during rendering. The existing `Mesh` artwork is rendered into the initial HTML with its CSS, theme variables, base typography, and early theme/scale selection. It does not wait for the reader bundle or swap from a different fallback gradient. When reduced motion is not requested, CSS slowly drifts and scales its blobs from that rendered first frame; there is no script or canvas. The homepage keeps its Maui-powered `ScrollDemo`, prompt controls, original logo, and footer.

Examples opens `/examples`: five title-and-description items in a left sidebar, with the selected full Productdoc in the main pane. Narrow screens use a horizontally scrolling example list above the reader; deep links reveal their selected item. The examples explain a login-session failure, plan durable storage in two small changes, and review the bundled session-store fixture. They are hand-authored samples, not customer projects or evidence of an executed production change. `exampleReader.tsx` mounts the existing `ViewerApp` with fixture-backed source and changes providers; explanation links read the before files, while review links read the after files and six-file patch. Plain HTML and Markdown remain readable without JavaScript. Comments use the existing browser-local reader behavior, not a hosted feedback inbox. An exact `/examples.md` rewrite serves the new index's Markdown representation. Host separation, shared-viewer routing, the live onboarding prompt, and the separate Diffmap landing page are unchanged.

Review phases independently:

1. **Content and initial HTML:** `content.ts`, `examples.ts`, `render.tsx`, `site.css`, `build.tsx`, `gist/website.html`, shared `Logo`, and the Vite multi-entry build. Examples use one familiar session-storage scenario across explanation, proposal, and review, with the proposal and bundled sample patch labeled separately.
2. **Agent-readable delivery:** `respond.ts`, `server.ts`, `api/docs.ts`, Vercel routing, Markdown outputs, discovery links, llms.txt, sitemap and robots. Both representations use `Vary: Accept` and `private, no-store`, so CDN cache separation is achieved by not caching either negotiated response. This is intentionally simpler than assuming Vercel honors arbitrary Vary keys. Public docs and shared documents have separate routing; no conversion of private/shared source is added.
3. **Website telemetry:** `telemetry.ts`, `client.ts` and the privacy notice. `websiteAnalyticsEnabled` is false. A later approved rollout must review the notice, consent UI, bot exclusions, and transport before enabling it. No PostHog SDK, autocapture, replay, remote dashboards, or joined CLI identity are added. Browser preferences cannot override the rollout gate.

## Draft dashboard definitions — do not create remotely

- Website page views: `website_page_view`, filtered to `product=product-docs`, `surface=website`, grouped by allowlisted `page`.
- Setup intent: `website_install_cta` with `action=release_status`. This measures opening release instructions, not skill installation or a command being run.
- Keep CLI/viewer usage in separate reports. Never use browser session IDs to join installation IDs, and leave historical events without attribution unlabeled.
- Counts exclude known bot user agents, webdriver, Do Not Track, Global Privacy Control, and non-consenting visits. These are consented non-obvious-bot events, not a count of all humans. Markdown fetches emit no browser events.

## Rollout checks still required

The public `product-doc` runtime and `generate-product-doc` GitHub skill are available. Onboarding explicitly installs the skill, then asks the agent to use it; the CLI guide is a separate acquisition step, not a skill installer. The homepage prompt is also included in its Markdown representation and llms.txt. A clean-project check verified the public installer, Amp scanner discovery, explicit skill loading by a fresh subagent, public guide, document validation and preview. This does not establish automatic skill selection in a fresh Amp session or isolation from account-level skills. Website analytics remains gated off; install intent is not a confirmed installation.

Search crawling is allowed; GPTBot, ClaudeBot and Google-Extended training use is conservatively disallowed independently. This policy is not an access-control guarantee. The preview sends `X-Robots-Tag: noindex`; the generated sitemap/canonicals target the live productdoc.dev website.

The production rollout verified HTTPS, current onboarding copy, HTML/Markdown negotiation in both request orders, missing-page 404s, and gist/GitHub viewer shells on productdoc.dev and www.diffmap.dev. Vercel attached the new domain to the existing project and updated its managed apex ALIAS; the other six DNS records and all three existing project-domain assignments were preserved. These checks do not establish historical shared-document contents or every CDN bot policy. Existing old-domain shared links must not become marketing redirects.

## Host separation

The shared deployment must keep the original Diffmap homepage on diffmap.dev/www.diffmap.dev and Productdoc on productdoc.dev. `respondPage` selects the existing `viewer.html`/Landing entry for Diffmap's homepage; Productdoc-only documentation/discovery requests on those hosts return 404 instead of cross-product content. Explicit ordered routes run before static-file lookup so the generated homepage and llms/robots/sitemap files cannot bypass this boundary. Ordinary rewrites alone do not override existing files on Vercel. Shared gist and GitHub viewer rewrites, static assets, the existing apex-to-www redirect, domain assignments and DNS stay unchanged. No banner is added.
