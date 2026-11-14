# Productdoc website

This work does not deploy the website, change DNS, approve npm releases, or enable analytics. The source-thread runtime/release files are deliberately not included. Productdoc is the successor to Diffmap, not a permanent parallel runtime.

## Local review

```sh
npm run build:gist
amp orb service start productdoc-website --command 'node --import tsx src/website/server.ts' --portal
```

The Vite build keeps the existing shared viewer in `dist/viewer.html`, and generates eleven public pages plus Markdown twins from `content.ts`. `gist/website.html` is the website entry; `gist/index.html` remains the shared viewer entry. Website HTML uses semantic native elements because the installed Maui/Purse provider requires `document` during rendering and cannot generate standalone no-JavaScript HTML. The homepage progressively mounts the original Maui-powered `ScrollDemo` and `Mesh` components: the same browser frame, interactive reader, Lagoon formation, and grain as the existing Diffmap homepage. The original logo is reused unchanged. The reader demo remains the labeled session-store example; the explain/plan/review links below it are grounded in this repository's actual multi-page-document journey.

Review phases independently:

1. **Content and initial HTML:** `content.ts`, `render.tsx`, `site.css`, `build.tsx`, `gist/website.html`, shared `Logo`, and the Vite multi-entry build. The real examples follow this repository's multi-page document journey. The plan is labeled historical, and review excerpts cite the recorded commit.
2. **Agent-readable delivery:** `respond.ts`, `server.ts`, `api/docs.ts`, Vercel routing, Markdown outputs, discovery links, llms.txt, sitemap and robots. Both representations use `Vary: Accept` and `private, no-store`, so CDN cache separation is achieved by not caching either negotiated response. This is intentionally simpler than assuming Vercel honors arbitrary Vary keys. Public docs and shared documents have separate routing; no conversion of private/shared source is added.
3. **Website telemetry:** `telemetry.ts`, `client.ts` and the privacy notice. `websiteAnalyticsEnabled` is false. A later approved rollout must review the notice, consent UI, bot exclusions, and transport before enabling it. No PostHog SDK, autocapture, replay, remote dashboards, or joined CLI identity are added. Browser preferences cannot override the rollout gate.

## Draft dashboard definitions — do not create remotely

- Website page views: `website_page_view`, filtered to `product=product-docs`, `surface=website`, grouped by allowlisted `page`.
- Setup intent: `website_install_cta` with `action=release_status`. This measures opening release instructions, not skill installation or a command being run.
- Keep CLI/viewer usage in separate reports. Never use browser session IDs to join installation IDs, and leave historical events without attribution unlabeled.
- Counts exclude known bot user agents, webdriver, Do Not Track, Global Privacy Control, and non-consenting visits. These are consented non-obvious-bot events, not a count of all humans. Markdown fetches emit no browser events.

## Rollout checks still required

Public npm currently contains a placeholder; no public install command is advertised. Recheck the fixed staged runtime and public skill flow before replacing the release-status link with installation.

Search crawling is allowed; GPTBot, ClaudeBot and Google-Extended training use is conservatively disallowed independently. This is a proposed policy for review, not an access-control guarantee. The preview sends `X-Robots-Tag: noindex`; the generated sitemap/canonicals target productdoc.dev for future rollout.

Vercel configuration is prepared, not deployed or verified on its CDN. Validate the function's included build files, root/docs/Markdown response behavior in both request orders, missing-page 404s, and unchanged gist/GitHub viewer routes on an approved deployment. Inspect CDN bot challenges separately; a local HTTP check cannot establish the deployed edge policy. Existing old-domain shared links must not become marketing redirects.
