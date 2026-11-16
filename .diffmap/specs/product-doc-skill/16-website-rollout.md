# Enable the public entry point last

[The public skill install](15-skill-cutover.md), [website](04-product-doc-website.md), [agent-readable docs](10-agent-readable-docs.md), and [website telemetry](11-website-telemetry.md) must be ready before this release operation.

## Today

Tanishq reports purchasing productdoc.dev. No domain routing, deployment, live PostHog configuration, or public branded install target has been established by this proposal.

## Proposed

With specific deployment/domain and analytics approval, move the product's website to productdoc.dev and enable its real installation CTA. Add an approved migration notice or redirect strategy for the old site, preserving old shared-document links rather than redirecting every path to the homepage. Configure only the reviewed product/surface reports in the existing project. Keep announcement separate from deployment so a broken live smoke test does not direct users into a failed install.

## Acceptance

Check the public site's HTML, Markdown, discovery links, crawler access, install target, social metadata, privacy notice, and responsive/accessibility behavior. Repeat the first-document journey from the public CTA. Confirm website intent and CLI usage remain separate metrics; do not fabricate cross-surface conversion. Verify opt-outs and any approved live payload check. Publish a support route and a concrete rollback path for the site/CTA without deleting users' documents.

Announce only after those checks pass. If a prerequisite regresses, disable the affected CTA or revert the site release rather than rewriting published packages. No deployment, purchase, publication, live test event, or shared project change is authorized by this plan.

```changes

```
