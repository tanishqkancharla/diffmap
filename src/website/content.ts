import { examplePages } from "./examples.ts";

export const origin = "https://productdoc.dev";
export const repository = "https://github.com/tanishqkancharla/diffmap";

export const examplePrompt =
  "Install the generate-product-doc skill from tanishqkancharla/diffmap, then use it to explain how this project works.";

export type Page = {
  path: string;
  title: string;
  description: string;
  label: string;
  body: string;
};

/** Public acquisition paths; the skill and runtime are installed separately. */
export const releaseStatus =
  "The product-doc CLI is available on npm, and generate-product-doc is available from the public GitHub repository. Install the skill into your coding agent; it reads the CLI guide before creating a document.";

export const pages: Page[] = [
  {
    path: "/",
    title: "Build software at the product level.",
    description:
      "Productdoc helps you plan and build software by creating interactive, visual documents.",
    label: "A shared understanding, before another line of code",
    body: `# Build software at **the product level**.

Productdoc helps you plan and build software by creating interactive, visual documents.
`,
  },
  ...examplePages,
  {
    path: "/docs/quickstart",
    title: "Your first Productdoc document",
    description:
      "Install generate-product-doc, load its CLI guide, and explain, plan, or review your first document.",
    label: "Quickstart · Get started",
    body: `# Your first Productdoc document

${releaseStatus}

## What you will need

A coding agent with access to your repository and shell, Git, Node.js 22 or newer, npm, and a browser. Amp is the initial onboarding target. You do not need a separate Diffmap runtime.

## Ask your agent to install and use the skill

From your project, give your agent this prompt:

\`\`\`text
${examplePrompt}
\`\`\`

Or install the skill yourself from the project directory, selecting your coding agent when prompted:

\`\`\`sh
npx skills add tanishqkancharla/diffmap --skill generate-product-doc
\`\`\`

For a non-interactive Amp installation, add --agent amp --yes. Then ask your agent to use generate-product-doc. If the current session does not discover the new skill, reload its skills or start a new session before continuing.

Installing the skill adds authoring instructions to your agent; it does not install the viewer globally. The skill tells the agent to run npx product-doc guide, which acquires the CLI from npm and prints its version-matched instructions. Running that command alone does not install the skill.

[Install, update, and remove](/docs/install)

## Ask a question worth documenting

Try “Use generate-product-doc to explain how sign-in works,” “Use generate-product-doc to plan this workflow in small changes,” or “Use generate-product-doc to review this branch and explain why it changed.” Give the agent the reader’s question and constraints, not just a list of files.

The agent loads the installed skill and CLI guide, inspects the repository, writes a cover and numbered Markdown pages in .diffmap/specs/, validates the document, and opens a local preview. A plan uses one small independent or commit-sized change per page.

## Read, question, revise

Open the preview. Follow the explanation before drilling into code. Highlight a passage or code lines, comment, and choose Copy comments. Paste that feedback to the agent so it can revise the document. Comments remain browser-local; copying is the handoff.

## Working from a source checkout

Contributors can run the checkout’s CLI to test changes that are not in the published package yet:

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
      "Install the authoring skill, acquire the CLI, and update or remove each independently.",
    label: "Documentation · Availability",
    body: `# Install, update, and remove

${releaseStatus}

## Install

From your project directory, install the public authoring skill and select your coding agent:

\`\`\`sh
npx skills add tanishqkancharla/diffmap --skill generate-product-doc
\`\`\`

For Amp without prompts, append --agent amp --yes. The skill is installed for your project unless you choose a global installation. Load generate-product-doc in your agent after installation; reload skills or start a new session if it is not discovered yet.

The skill’s first step acquires the public CLI and loads its guide:

\`\`\`sh
npx product-doc guide
\`\`\`

These are separate steps: the skills installer makes the authoring skill available to your agent; npx acquires and runs the product-doc CLI. Neither requires installing the old Diffmap package. Git, npm and Node.js 22 or newer are required.

## Update

Update the skill from the same project or global scope in which you installed it:

\`\`\`sh
npx skills update generate-product-doc
\`\`\`

The skill reads the guide from the CLI it runs. For an explicit refresh of the public CLI, run npx product-doc@latest guide. If you installed the CLI globally, run product-doc update to use its supported package-manager update path. Restart an existing viewer after updating its runtime.

## Remove

Remove the skill from the same scope and agent in which you installed it, for example npx skills remove generate-product-doc --agent amp for a project-local Amp install. Add --global only if it was installed globally.

Using the CLI through npx does not create a global product-doc installation. If you chose a global npm installation, remove it with npm uninstall -g product-doc. Keep repository documents and existing Diffmap configuration; removing a skill does not require deleting them.

[Migration notes](/docs/migration) · [Report an installation problem](${repository}/issues)
`,
  },
  {
    path: "/docs/migration",
    title: "Coming from Diffmap",
    description:
      "Use Productdoc alongside Diffmap while preserving existing documents, skills and shared links.",
    label: "Documentation · Migration",
    body: `# Coming from Diffmap

Productdoc and Diffmap are available alongside one another. Productdoc lives at productdoc.dev and expands visual documents to explaining existing systems and planning future work as well as reviewing changes. Diffmap keeps its original website at diffmap.dev; it is not being retired as part of this rollout.

## What stays put

Keep documents in .diffmap/specs/. Do not remove existing installs or shared-document links as part of migration. Existing diffmap.dev shared links should continue to open their documents, not redirect to a marketing homepage.

## What is changing

For Productdoc, the public npm package and executable are product-doc, and the skill is generate-product-doc. Install that skill and use its CLI guide when asking for Productdoc documents. The generate-diffmap skill remains available too; installing Productdoc does not require removing or replacing it. Keep each tool's existing installation and use the skill you intend.

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

## The agent cannot find the skill or CLI

The authoring skill and runtime are separate. Install generate-product-doc from tanishqkancharla/diffmap using npx skills add, then reload your agent’s skill list or start a new session if necessary. Running npx product-doc guide alone does not install the skill.

Check Node.js is version 22 or newer and that Git and npm can reach GitHub and the npm registry. If npx reuses an old CLI, try npx product-doc@latest guide. Use the successor’s guide rather than substituting the legacy Diffmap guide. If a skill is listed but not being used, explicitly ask the agent to load generate-product-doc; scanner discovery alone does not prove that it loaded the skill.

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
