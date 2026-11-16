# ⏳ Attribute productdoc usage in the same PostHog project

[The skill](01-product-doc-skill.md) introduces the broader document workflow. [The CLI rename](07-branded-cli.md) now makes productdoc the primary runtime. Events carry fixed product and surface properties in the existing PostHog project. Implemented locally, not committed or released; no project settings or dashboards were changed.

## Before

Published Diffmap reports anonymous command and local-viewer events without a product label. The coding-agent field identifies the agent, not the skill. Earlier local work used an environment marker to separate successor workflows on that runtime; that temporary approach is no longer needed after the rename.

## Built locally

The sender always attaches `product: product-docs`. It attaches `surface: cli` to command events and `surface: viewer` to forwarded viewer actions. Neither an environment marker nor browser input can impersonate a different product or surface. The same endpoint, project, event names, anonymous installation ID, and opt-outs are retained; events are not duplicated.

Illustrative payload, matching the implemented values rather than a new API:

```tsx
const product = "product-docs";
const event = {
  name: "viewer_engaged",
  properties: { product, surface: "viewer", trigger: "scroll" },
};
sendToExistingPostHogProject(event);
```

```services
service Agent "Productdoc workflow"
service CLI "Productdoc CLI"
  state product = product-docs
service Browser "Local reader"
service PostHog "Existing PostHog project"
  state events = none

start "Separate reporting without a second project"
  > The CLI fixes product attribution for command and viewer events. PostHog can separate surfaces with filters, without a second ingestion project.
step "The agent serves a document"
  Agent -> CLI: serve existing document
step "The CLI records command usage"
  CLI -> PostHog: command_run, product-docs, cli
  PostHog.events = command event
step "The reader engages with the preview"
  Browser -> CLI: allowlisted viewer_engaged event
  CLI -> PostHog: viewer_engaged, product-docs, viewer
  PostHog.events = command and viewer events
```

This diagram shows routing, not evidence of live transmission. Tests intercept traffic before network writes.

## Privacy and interpretation

Keep `.config/diffmap/telemetry-id`, `DIFFMAP_TELEMETRY`, `DO_NOT_TRACK`, development-mode and CI opt-outs compatible so migration preserves identity and privacy choices. Never send titles, paths, contents, prompts, comment text, raw environment values, or error messages. Existing published Diffmap installations are unchanged; historical events without `product` stay legacy/unattributed.

The label measures runtime usage, not proof of skill installation, automatic triggering, document completion, or comprehension. Website reporting and browser-to-CLI identity linking remain separate work.

## Executed checks

The compiled CLI integration check in [[src/cli.test.ts]] intercepts HTTPS, runs guide commands with no marker and forged legacy/private markers, verifies the same anonymous ID, and checks every existing opt-out. It starts a real server, posts viewer-open, comment, and engagement actions, and shuts it down. Captured serialized events preserve attribution, deduplicate viewer-open, discard forged browser properties, and contain no private title, path, comment, or marker. The full suite passes **70 tests**.

**Important:** [[src/telemetry.ts]], [[src/cli.ts]], [[src/cli.test.ts]], and [[TELEMETRY.md]]. Creating dashboards, sending deliberate live events, and changing PostHog settings still require specific approval.

```changes

```
