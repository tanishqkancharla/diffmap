export const origin = "https://productdoc.dev";
export const repository = "https://github.com/tanishqkancharla/diffmap";
const source = `${repository}/blob/4fc4811`;

export type Page = {
  path: string;
  title: string;
  description: string;
  label: string;
  body: string;
};

/** Release gates are facts, not a browser setting. No public install command yet. */
export const releaseStatus =
  "Productdoc is in release preparation. The fixed product-doc@0.13.2 candidate is staged, not approved or live. Public npm currently contains only a placeholder. Public skill installation is not yet verified.";

export const pages: Page[] = [
  {
    path: "/",
    title: "Build software at the product level.",
    description:
      "Productdoc turns your agent’s work into visual documents so you can focus on what the software does, the decisions that matter, and whether it matches what you meant to build.",
    label: "A shared understanding, before another line of code",
    body: `# Build software at the product level.

Your agent can write more code than you can reasonably review. Productdoc turns that work into visual documents so you can focus on what the software does, the decisions that matter, and whether it matches what you meant to build.

## Focus on the questions that matter

Follow one real journey from this repository: opening and reviewing a multi-page document. These examples use existing source, the project’s actual plan, and a recorded commit—not a fictional customer story.

### Does this behave the way I expect?

What happens when a reader opens a document? Follow the cover, page links, and browser-local feedback, including what happens when a page is missing.

[Read the explanation](/examples/explain)

### Is this the right approach?

How do you break a long document into pages without losing the reader? See the original multi-page plan, one small change at a time, with decisions and verification.

[Read the plan](/examples/plan)

### What does this change mean for the product?

Did the agent’s guidance change with the product? Review a real commit that moved authoring from one long file to a cover and numbered pages, including a prose before/after.

[Read the review](/examples/review)

## The code is there when you need it.

It just isn’t where every conversation has to start.

Your agent starts with the reader’s question and checks the code. The document explains the behavior, decisions, and failure paths. Diagrams, call stacks, source links, and visible results support the explanation; they do not replace it.

Read it, highlight a passage or code, leave a comment, then use **Copy comments** to return feedback to your agent. Comments stay in that browser until you copy them; they are not a hosted team inbox.

## One product, a broader purpose

Productdoc is the successor to Diffmap, not another layer to install on top. Existing documents stay in .diffmap/specs/. Published Diffmap installs and shared-document URLs are unchanged during release preparation.

[Read the quickstart and release status](/docs/quickstart)

[Coming from Diffmap?](/docs/migration)
`,
  },
  {
    path: "/examples/explain",
    title: "Opening a document, without losing your place",
    description:
      "An explanation grounded in Productdoc’s existing multi-page reader and browser-local comments.",
    label: "Explain · Existing behavior",
    body: `# Opening a document, without losing your place

A reviewer should be able to open the cover, jump to the change they care about, and send feedback without reading the whole repository. Here is how the existing reader supports that journey.

## From a directory to a page

The local server reads a document directory. README.md supplies the cover; numbered Markdown files supply the remaining pages. The number determines reading order, not the local URL slug. Renumbering a page therefore does not by itself change its local link.

**Reading flow:** document directory → validate the cover and numbered pages → resolve the requested page → show that page and its neighbors. The server owns loading and validation; the browser owns navigation and feedback.

\`\`\`mermaid
flowchart TD
    Directory[Document directory] --> Validate[Validate cover and numbered pages]
    Validate --> Resolve[Resolve requested page]
    Resolve --> Found{Page exists?}
    Found -->|Yes| Show[Show page and its neighbors]
    Found -->|No| Missing[Return not found]
\`\`\`

\`\`\`ts
// Pseudocode for the existing reader, not a new API.
const document = readDirectory(target);
const page = document.findBySlug(requestedSlug);
if (!page) return notFound();
return showPage(page, document.previous(page), document.next(page));
\`\`\`

The cover is required. A non-numbered page is an error rather than silently acquiring an arbitrary position. A missing page is not replaced with the cover: the reader needs to know that their link did not resolve.

[Page rules in source](${source}/src/spec.ts) · [Directory loading](${source}/src/readSpec.ts) · [Local serving](${source}/src/serve.ts)

## Feedback belongs to the page you read

Select a passage or code lines and leave a comment. The reader stores comments in localStorage under the page’s URL path. Copy comments gathers feedback across the document, grouped by page, for you to paste back to the agent.

For example: “The cover explains how to open a document, but not what happens to my comments after refresh.” The agent can clarify the document: “Comments survive refresh in this browser; they do not sync to another browser.” This is an illustrative feedback exchange about real behavior, not a claim of a hosted collaboration service.

[Comment storage](${source}/src/viewer/comments.ts) · [The actual multi-page document](${source}/.diffmap/specs/multi-page-specs/README.md)

## Boundaries that matter

- Local comments are not automatically sent to the author. Copy and return them.
- An unlisted shared gist is readable by anyone with its URL; it is not private access control.
- A shared snapshot does not keep following later local edits.
- Local media cannot currently be included by gist sharing; use HTTPS media or the pull-request format.

[Next: the plan behind multi-page documents](/examples/plan)
`,
  },
  {
    path: "/examples/plan",
    title: "Make a long review navigable",
    description:
      "A real plan from this repository, separated into small changes with decisions and checks.",
    label: "Plan · Historical project plan",
    body: `# Make a long review navigable

The original problem was simple: one Markdown file accumulated a dozen phases. A reviewer looking for Phase 4 scrolled through everything before it, and an agent updating one phase could accidentally damage another.

This is a condensed reading of the repository’s actual multi-page plan, not a newly proposed or unimplemented feature. The linked source preserves the original decisions and implementation pages.

## Outcome and boundaries

Give the document a cover and each small independent change its own page. Keep a stable reading order, page-specific links, and feedback grouped by page. Do not add nested books or search across all pages.

## Why filenames own the order

Number prefixes make the order visible in Git and directory listings. A separate manifest would create a second list for the agent to keep in sync; front matter would hide order until each file was opened. Local and gist URLs omit the number, so inserting a page need not break existing links.

\`\`\`ts
// Planned behavior, now implemented in the existing reader.
const pages = [cover, ...numberedPages.sort(byNumber)];
const href = page.isCover ? "/" : "/" + page.slugWithoutNumber;
\`\`\`

## Review each small change separately

1. [Read a document directory](/examples/plan/read): establish the cover, page order, and validation contract first.
2. [Serve pages at their own URLs](/examples/plan/serve): resolve a page and reload the directory without changing that contract.
3. Add navigation, then align authoring guidance and sharing. Each has its own page in the original plan, rather than one page per source file.

[Read the original plan and its seven pages](${source}/.diffmap/specs/multi-page-specs/README.md)

## What the reviewer should decide

Is one cover and one page per small change the right reading unit? Do the stable slugs and explicit errors preserve enough context when pages move? The plan explains those tradeoffs before listing implementation files.

[Next: review the actual guidance change](/examples/review)
`,
  },
  {
    path: "/examples/plan/read",
    title: "1. Read a document directory",
    description:
      "One small change: define and validate the cover and page ordering.",
    label: "Plan · Change 1",
    body: `# 1. Read a document directory

**Goal:** a reader opens a directory with one unambiguous cover and a deliberate page order. This page condenses the first small change in the historical plan; the behavior is now implemented.

## Contract

Require README.md. Other Markdown pages have number prefixes. Sort them numerically, derive titles from their first heading, and reject duplicate slugs. Keep the cover separate from the sequence of change pages.

## Prerequisite

Agree on the directory shape before the server or browser depends on it. This phase does not introduce navigation UI or sharing.

## Verify

Check a cover-only directory, pages numbered 2 and 10, a missing cover, a non-numbered page, and duplicate slugs. The errors should name the input the author must fix.

[Original implementation plan](${source}/.diffmap/specs/multi-page-specs/01-read-a-directory.md) · [Current public contract tests](${source}/src/spec.test.ts)

[Next small change: serve the pages](/examples/plan/serve)
`,
  },
  {
    path: "/examples/plan/serve",
    title: "2. Give each page its own URL",
    description:
      "One small change: resolve and reload pages using the directory contract.",
    label: "Plan · Change 2",
    body: `# 2. Give each page its own URL

**Goal:** opening a page directly shows that page, and editing it updates the reader without losing the document around it. This condenses the second change in the historical plan, now implemented.

## Depends on the directory contract

Use the cover at the root and resolve other pages by stable slug. Read and validate the document before serving it. Watch its directory, so adding, removing, or retitling a page updates the page list too.

## Failure behavior

A missing page must be a 404. A malformed document should name the authoring error, not leave an apparently successful blank page. This phase does not redesign the reader’s navigation.

## Verify

Open the cover and a non-cover page directly. Check a missing slug. Edit a page, add another, and remove one while the reader is open; verify the content and page list refresh.

[Original implementation plan](${source}/.diffmap/specs/multi-page-specs/02-serve-pages.md) · [Serving tests](${source}/src/serve.test.ts)

[Return to the plan](/examples/plan)
`,
  },
  {
    path: "/examples/review",
    title: "Make the agent write the document readers can navigate",
    description:
      "Review a real commit’s authoring-guidance and prose change, without inventing a diff.",
    label: "Review · Recorded commit",
    body: `# Make the agent write the document readers can navigate

Once the reader supports pages, the agent must actually write them. Commit 9636b02 changed the guide, README, CLI help, and book fixtures to teach the new shape. This is a review of that recorded change, not a claim about the unreleased Productdoc package.

## Before and after

Before, the opening guide described a Markdown file. After, it described a directory with a README.md cover and one numbered page per phase. The prose change matters: without it, an agent could keep producing one long file for a multi-page reader.

The following opening paragraphs are from that commit’s real guide diff; the link below opens the complete change.

\`\`\`diff
-A spec is one Markdown file at \`specs/<short-kebab-case-name>.md\` that shows the current system, the plan, and the work done. Update it as the plan changes and work lands. For a walkthrough of an existing pull request, use its spec if it has one; otherwise write under \`.diffmap/\`. Check the repo's paths and symbols before writing.
+A spec is a book: a directory at \`.diffmap/specs/<short-kebab-case-name>/\` that shows the current system, the plan, and the work done, one page per phase. Update it as the plan changes and work lands. For a walkthrough of an existing pull request, use its spec if it has one; otherwise write one in the same place. Commit specs with the code; \`.diffmap/\` is not ignored. Check the repo's paths and symbols before writing.
\`\`\`

[Inspect the actual commit](${repository}/commit/9636b02efa44feed0a791bd489a972d1a42acf1c) · [Read the guide at that commit](${repository}/blob/9636b02efa44feed0a791bd489a972d1a42acf1c/guide.md)

## Why this is more than a file-layout change

The cover carries the problem and goals. Each numbered page carries a phase’s reasoning and evidence. Code references support those explanations instead of dictating one page per source file. That is the contract a reader needs to judge the plan before accepting the implementation.

The current Productdoc guide sharpens this further: one small independent or commit-sized change per page, rather than a large phase bundling unrelated work.

## What this review does not prove

Reading the commit establishes what changed. It does not establish fresh-user onboarding, public package availability, or whether every generated document is understandable. Those need their own checks; a published source commit and a staged npm release are different delivery states.

[Start a document when the release is ready](/docs/quickstart)
`,
  },
  {
    path: "/docs/quickstart",
    title: "Your first Productdoc document",
    description:
      "Prerequisites, release status, and the explain–plan–review workflow, without an unavailable install command.",
    label: "Quickstart · Release preparation",
    body: `# Your first Productdoc document

${releaseStatus}

## What you will need

A coding agent with access to your repository, Node.js 22 or newer, npm, and a browser. Amp is the initial onboarding target. The successor skill is generate-product-doc; the CLI package and executable are product-doc. You will not need a second Diffmap runtime alongside it.

## Installation is gated

There is no supported public Productdoc install command to run yet. Do not install the npm placeholder expecting the runtime. The primary skill-install action will become available only after both the runtime and public skill path are verified.

[Install, update, and remove status](/docs/install)

## Ask a question worth documenting

Start with “Explain what happens when a reader opens a document,” “Plan how to split this workflow into small changes,” or “Review what changed on this branch and why.” Give the agent the reader’s question and any constraints, not just a list of files.

The installed skill loads the CLI’s version-matched guide. The agent inspects the repository, writes a cover and numbered Markdown pages in .diffmap/specs/, validates the document, and opens a local preview. A plan uses one small independent or commit-sized change per page.

## Read, question, revise

Open the preview. Follow the explanation before drilling into code. Highlight a passage or code lines, comment, and choose Copy comments. Paste that feedback to the agent so it can revise the document. Comments remain browser-local; copying is the handoff.

## Working from a source checkout

Contributors with the successor runtime changes already applied can use the repository’s CLI without pretending it is on npm:

\`\`\`sh
npm run cli -- guide
npm run cli -- validate .diffmap/specs/my-document/
npm run cli -- serve .diffmap/specs/my-document/
\`\`\`

These are checkout commands, not public installation instructions. Use the guide emitted by your runtime; the older published Diffmap guide is not a substitute for the successor guide.

[See the examples](/examples/plan) · [Troubleshooting](/docs/troubleshooting)
`,
  },
  {
    path: "/docs/install",
    title: "Install, update, and remove",
    description:
      "The supported acquisition path is still gated on the public runtime and skill release.",
    label: "Documentation · Availability",
    body: `# Install, update, and remove

${releaseStatus}

## Install

Public installation is not supported yet. The intended entry point is the generate-product-doc skill, backed by the unscoped product-doc CLI package. No public install command is advertised until both paths work from a clean environment. The CLI requires Node.js 22 or newer.

## Update

The successor runtime includes an update command, but it must not be used to acquire the placeholder package. Wait for a verified public release and its version-matched instructions. Existing published Diffmap installations remain unchanged.

## Remove

There is no released successor installation to remove yet. For a manually tested candidate, remove the generate-product-doc skill from the same agent scope in which you installed it, and remove the candidate using the package manager and method you used. Do not delete repository documents or existing Diffmap configuration as part of removing a skill.

[Migration notes](/docs/migration) · [Report an installation problem](${repository}/issues)
`,
  },
  {
    path: "/docs/migration",
    title: "Coming from Diffmap",
    description:
      "One successor product, with existing documents and shared links preserved during migration.",
    label: "Documentation · Migration",
    body: `# Coming from Diffmap

Productdoc is Diffmap’s successor: the scope expands from reviewing changes to explaining existing systems and planning future work too. The folded-map logo stays. This is not a permanent pair of runtimes or a skill layered on top of a separate Diffmap product.

## What stays put

Keep documents in .diffmap/specs/. Existing published Diffmap packages, the legacy skill, and shared-document links are not changed by this website preview. Existing diffmap.dev shared links should continue to open their documents, not redirect to a marketing homepage.

## What is changing

The name is Productdoc, the destination domain is productdoc.dev, the npm package and executable are product-doc, and the successor skill is generate-product-doc. Public runtime release and skill cutover are not complete. Do not replace a working install with npm’s placeholder.

Retained configuration names such as DIFFMAP_TELEMETRY and the diffmap configuration directory preserve existing privacy choices during migration.

[Check release status](/docs/install) · [Privacy](/privacy)
`,
  },
  {
    path: "/docs/troubleshooting",
    title: "Troubleshooting and feedback",
    description:
      "Recover from document, preview, sharing, and feedback problems.",
    label: "Documentation · Support",
    body: `# Troubleshooting and feedback

## The install does not provide the runtime

Only a placeholder is public on npm. The staged candidate is not a public release. Wait for verified runtime and skill availability rather than substituting an unrelated package or old guide.

## A document does not validate

Pass its directory, not a single page. Include README.md and number the remaining Markdown pages. Use the installed runtime’s guide and validate command; errors should identify the page to fix. Do not fabricate commit references for work that is still uncommitted.

## Feedback did not reach the author

Comments stay in the reader’s browser. Choose Copy comments, then paste them to the agent. Another browser or device will not automatically see them.

## Sharing fails on media

Gist sharing currently rejects local media. Use HTTPS media or the supported pull-request format. Review every snapshotted file before sharing: an unlisted gist is not private.

## Still blocked?

[Search existing issues or report a problem](${repository}/issues). Include the command, version, expected behavior, and a minimal public-safe example. Leave out private source, tokens, and unlisted document URLs.
`,
  },
  {
    path: "/privacy",
    title: "Privacy, without a joined funnel",
    description:
      "What the website may measure, how to opt out, and how it stays separate from CLI usage.",
    label: "Privacy · Website and runtime boundaries",
    body: `# Privacy, without a joined funnel

## This website preview

Website analytics collection is disabled in this preview. It does not load Vercel analytics or a PostHog SDK on documentation pages. Reading HTML, Markdown, or llms.txt does not require executing analytics.

## Prepared website measurement

The local implementation is limited to page views and the primary install CTA action, in the existing PostHog project with product=product-docs and surface=website. Live ingestion requires a separately approved rollout. Collection requires opt-in, honors Do Not Track and Global Privacy Control, and has no autocapture or session replay.

Only an allowlisted public page identifier and action are eligible. No query strings, fragments, referrers, document contents, copied text, repository paths, or CLI identifiers are included. A random browser-session identifier is separate from the CLI’s installation identifier. Known automated browsers and bot user agents are excluded on a best-effort basis, not treated as reliably detected humans.

## Intent is not installation

Opening setup instructions or copying a command does not establish installation. Website intent and CLI usage must be reported separately, not joined into a person-level conversion funnel.

## The runtime and shared reader

The successor runtime retains DIFFMAP_TELEMETRY=0 and DO_NOT_TRACK=1 opt-outs and existing configuration locations. Existing published Diffmap releases and shared-viewer behavior are not changed by this website work. Unlisted shared documents are not private. Reader comments are browser-local until copied.

[Read the runtime telemetry policy](${repository}/blob/main/TELEMETRY.md) · [Ask a privacy question](${repository}/issues)
`,
  },
];

export function markdownPath(path: string) {
  return path === "/" ? "/index.md" : `${path}.md`;
}
