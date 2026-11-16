# Adapt the website for productdoc

[Identity](06-launch-identity.md) establishes productdoc.dev as the destination for the product's renamed website. This is the public identity and scope evolving, not a second site marketing an optional skill over a permanent Diffmap product. No deployment or routing has been changed.

## Today

The current site leads with diff review, uses Diffmap branding, and starts from a JavaScript app shell. The renamed product's website is not built. Tanishq reports owning productdoc.dev; hosting and DNS remain unconfigured here.

## Proposed

Adapt the existing site's copy, examples, navigation, install entry point, title, social metadata and privacy/support links for productdoc. Lead with explaining existing systems, planning future work and reviewing changes. Show [real examples](09-product-examples.md) before asking for setup. Offer one primary skill-install action; the CLI is acquired through its own package, not through a separately required Diffmap install.

Deliver meaningful initial HTML for the product promise, prerequisites and docs links via static generation/prerendering. Keep interactive demos where useful. Use semantic headings, real links, labeled controls, descriptive alt text, and textual reasoning alongside diagrams/media. Check narrow layouts and keyboard navigation.

Canonical URLs, sitemap, robots/indexing choices and real 404s belong with content delivery. Make search discovery and training permission separate decisions, and check CDN challenges do not block intended docs fetchers. Any structured data must match visible facts.

Keep unavailable install CTAs gated until [public successor installation](15-skill-cutover.md) works. [Markdown/discovery delivery](10-agent-readable-docs.md) and [website telemetry](11-website-telemetry.md) remain separate small changes.

## Acceptance

A visitor can understand productdoc without knowing Diffmap first, while an existing user can find a concise migration path. Verify text without JavaScript, actual example links, accessibility, mobile-width layout, install prerequisites and metadata. Do not claim the new domain is serving until it is deployed and checked.

[Rollout](16-website-rollout.md) owns approved DNS/deployment actions and the old site's migration notice or redirects. Preserve old shared-document URLs deliberately; do not blanket-redirect them to the new homepage or assume private access control from an unlisted URL.

```changes

```
