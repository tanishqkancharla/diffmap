# Measure website intent separately

[CLI telemetry](03-attribute-product-telemetry.md) separates product and surface in the existing PostHog project. This phase adds only the new website's measurement and notice, after [website content](04-product-doc-website.md) is reviewable.

## Today

The current site includes Vercel analytics with sanitized gist routes in [[gist/index.html]]. No new website/PostHog integration or joined website-to-CLI identity exists.

## Proposed

Use the same PostHog project with fixed `product=product-docs` and `surface=website`. Limit collection to reviewed page views and install CTA actions. Add the collection notice and appropriate consent/opt-out behavior. No default autocapture or replay. Do not change existing shared-viewer PostHog behavior.

Report website intent and CLI usage separately. A command copied from a website does not prove installation, and an anonymous browser visitor is not automatically the same identity as an anonymous CLI installation. Keep known bot requests separate from human intent metrics without pretending user-agent classification is infallible; Markdown fetches need not execute browser analytics.

## Acceptance

Inspect serialized payloads using a local/test transport: no document content, copied text, private paths, query strings, or unexpected referrers. Test opt-out and navigation. Draft product/surface dashboard definitions without creating remote dashboards or enabling ingestion. Live project changes require specific approval and belong to [rollout](16-website-rollout.md).

```changes

```
