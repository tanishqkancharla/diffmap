# Ship the path to a useful productdoc document

Productdoc is the standalone product going forward, replacing Diffmap's name and expanding beyond reviewing changes. The temporary two-skill period is a migration stage, not a permanent choice between two products. [The overview](README.md) splits the implementation into small phases.

**State:** the local skill stub, authoring guide and telemetry attribution exist. The renamed runtime/package, website, clean public onboarding and user migration have not shipped.

## 1. Discover the promise

**Reader:** “Can this help me understand or decide something?”

The website should introduce productdoc directly: explain what exists, plan what should change, and review what happened. Adapt hero, examples, prompt, install CTA, metadata, social image, footer, and privacy/support links together. A new headline over an unchanged diff-review demo is not sufficient.

**Gate:** a new visitor understands the promise without first learning Diffmap. An existing user can find a migration note without mistaking the two skill names for permanent competing products. See [website adaptation](04-product-doc-website.md).

## 2. See a useful document before setup

**Reader:** “What will I get?”

Use a real, public-safe example that evolves through explanation, planning and review. Begin with familiar actions/workflows or involved services, not source files. Plans show one small change per page. Include a prose change preview and useful diagrams. Label observed behavior, proposed work, and illustrative mockups distinctly.

**Gate:** a reader unfamiliar with the code can explain the outcome, reason and decision. Engagement is not evidence of comprehension. See [examples](09-product-examples.md).

## 3. Install one skill

**Reader:** “What do I need?”

Offer `generate-product-doc` as the primary entry point. It is a short stub; the substantive instructions come from `product-doc guide`. The runtime package is productdoc itself, not a wrapper that requires users to install Diffmap too. Skill installation from Git and runtime acquisition from npm are different mechanisms, even when the agent handles both.

The stub points only to the successor guide; the README gates public installation while the new package is unpublished. Do not advertise that primary command as working until release verification. Repository URL spelling does not determine the future public brand.

**Gate:** the exact public installer works in a clean Amp environment, discovers the stub and acquires the released runtime. Copying a command is intent, not installation success.

## 4. Create the first document

**Reader:** “What should I ask?”

Give a recipe that does not require a branch diff: explain an existing system, plan future work, or review a change. The agent obtains the CLI guide, inspects evidence, writes the document, validates it and leaves a reachable preview. The guide owns the authoring rules and syntax so the stub does not become a stale second manual.

**Gate:** test this on a clean setup, not just the prepared checkout. Include recovery for missing prerequisites, undiscovered skills, invalid documents and unreachable previews. Local guide-output tests are useful but do not prove automatic triggering. See [onboarding](13-clean-onboarding.md).

## 5. Read and decide

**Reader:** “Do I understand what exists or what should change?”

Show the behavior and reasoning before code. Inspect diagrams, media, prose previews, page navigation and narrow layouts. Keep document titles derived from the README, not replaced with the product brand. Explanations need no artificial change plan; plans split independent changes into small pages.

**Gate:** readers can explain the outcome and decision. `serve_result`/`viewer_opened` and `viewer_engaged` are arrival/engagement signals, not approval or comprehension.

## 6. Give feedback and share safely

**Reader:** “Can someone review this?”

Demonstrate comments, Copy comments, returning feedback to the agent, and revising the same document. Comments are browser-local today, not synchronized team collaboration. Local preview and publication are different actions.

Existing gist sharing requires GitHub tooling/authentication, can snapshot source, and is unlisted rather than private. Local media currently blocks that share route. Choose a supported format for public examples and verify a second reader can open it. Preserve old shared URLs through the website migration rather than silently breaking them.

**Gate:** a reader's feedback produces a visible revision and the selected share route works with its stated media/privacy limits.

## 7. Return and migrate

**Reader:** “Will my existing work still work?”

Keep the same documents as understanding and implementation evolve. Test reopening existing specs and source links under productdoc. Update instructions, package identity and support/rollback guidance coherently. Old users should be invited to migrate to the successor skill; a temporary fallback is not indefinite dual-brand maintenance.

**Gate:** migration does not require duplicate documents, another product account, or loss of comments/links. Separate approved actions for the old npm package, old skill notice, updater behavior and website redirects. Do not delete/deprecate anything automatically. See [migration](15-skill-cutover.md).

## Telemetry measures transition, not two permanent businesses

The locally implemented fixed labels distinguish legacy Diffmap traffic from productdoc workflow traffic in the existing PostHog project. They are not a commitment to separate permanent product lines. Website intent and anonymous CLI use remain different populations; no browser-to-CLI identity join has been implemented. Website collection remains [a separate phase](11-website-telemetry.md).

## Release order

Build the primary productdoc CLI and package, prepare its publisher and clean onboarding, then publish with approval. Verify the live artifact and successor skill before enabling public installation. Enable the website CTA and invite migration only after the public install path works. Keep website/DNS/redirect and analytics actions separately reviewable and approved.

Illustrative gate, not an implemented release API:

```tsx
const readyToInviteMigration =
  runtime.publicInstallWorks &&
  successorSkill.verified &&
  existingDocuments.reopen;
```

This plan is grounded in [[package.json]], [[src/cli.ts]], [[src/update.ts]], [[.github/workflows/publish.yml]], [[guide.md]], [[skills/generate-product-doc/SKILL.md]], [[src/landing/Landing.tsx]], [[gist/index.html]], and [[TELEMETRY.md]]. No public release, hosting or settings change is claimed.
