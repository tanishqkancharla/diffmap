# Productdoc documents

The goal of Productdoc is to create visual-first explainer documents for the user.

There are three base kinds of documents with default structures:

- **Planning**
- **Explain existing system**
- **Review**

Caveats to following this guide:

- For simple documents that do not need much structure, simplify or ignore these templates as appropriate.
- For unique documents that do not fit any of these structures, ignore them and shape the document around the question.
- The user's preferences for how to structure a document always take precedence.

Treat these structures as template suggestions. Use abstract reasoning and bottom-up first-principles thinking about what helps the user most when deciding how closely to follow them or whether to add or drop sections and pages.

A request to explain, plan, or review does not authorize implementing a proposal. Label anything that is not built yet as proposed or illustrative.

## General principles

- **Make the document visual first.** Use a diagram, code block, or UI preview wherever the reader would otherwise piece a flow together from paragraphs, and use a list when the content is already a simple sequence.
- **Keep pages short: roughly one screen per page, with minimal scrolling.** Keep pages short by letting diagrams, previews, code, and numbered flows carry the detail and splitting distinct flows onto separate pages—never by writing clipped sentence fragments.
- **Write in full, simple sentences.** Explain what happens and why in clear, complete sentences.
- **Show things from the end user's point of view.** For an app, that is the screens and states a person sees. For a library, CLI, or API, it is the calls and results a developer writes.
- **Infer the end-user flows before you start, and align on them with the user.** Inspect the relevant source, state the flows and scope boundary you inferred, and ask up to two alignment questions before you write, most important first. Wait for answers unless scope is already settled.
- **Make the cover a summary with a bulleted page list.** Open `README.md` with the core idea and list the phase or topic pages as bullets, one line per page.
- **Use short, literal titles.** Title documents, pages, and sections in 2–5 plain words, like a pull request or feature name—such as "Add dark mode", "Billing service", "Redis vs. Postgres", or "Phase 1: Checkout"—rather than sentence-long headlines.
- **Keep one clear thesis.** When the user asks a question or gives feedback, revise the existing sections and visuals around the core thesis instead of tacking on extra sections.
- **Check facts against the source code.** Read the code that owns the behavior and place source references beside the claims they support.

## Planning

Default structure for planning documents:

- **Cover (`README.md`)**
  - **Intro paragraphs:** explain what is being built, with visual mocks or media if possible, and high-level tradeoffs. When the work includes UI, set up the preview component (`npx product-doc guide previews`) and render visual mocks with `preview` or `flow` blocks.
  - **Implementation section:** explain how it will be implemented, followed by a bulleted list of the phase pages (planned MVP-first, starting from the smallest usable end-user outcome), one bullet per phase with its link and one sentence on what it adds. Include brief pseudocode if helpful.
- **Phase pages (`01-<slug>.md`, `02-<slug>.md`, …)**
  - **Title heading:** short, literal phase title (`# Phase 1: Sign in`), plain when planned, `⏳` in progress, and `✅` done.
  - **Intro:** brief, simple explanation of how things work today and what is planned to change.
  - **Media:** ideally a diff form, such as an interactive `services diff` or `callstack` diff, showing how the phase works.
  - **Phase goals:** the end-user flows that are the goal of this phase (including key failure or recovery paths), under the heading `## Phase goals`. Write each goal as what the end user does and sees, because that is what the reader already understands. Attach media to each goal in the end user's own medium: for an app, an interactive `flow` or `preview` block with real or mock React components (`npx product-doc guide previews`); for a library or API, the code a developer writes and the result it returns; for a CLI, the command and its output. Use pseudocode when the real interface does not exist yet.

## Explain existing system

Default structure for explanation documents:

- **Cover (`README.md`)**
  - **Intro paragraphs:** what the system does for its end user, and the question this document answers. Include a visual of the system if one helps, such as a UI preview, screenshot, or example code.
  - **Pages section:** a bulleted list linking each page, with one sentence on what it explains.
- **Pages (`01-<slug>.md`, …), one per flow or part of the system**
  - **Intro:** brief, simple explanation of what this part does and why it matters to the user.
  - **User flows:** the end-user flows as they work today, as numbered steps, including the failure path that matters (with `flow` / `preview` blocks or code examples alongside them).
  - **Media:** an interactive `services` diagram or `callstack` that shows how the system carries those flows.

If the user is comparing options, show each option's flows side by side on the same page. Organize pages around how the system works today rather than implementation phases.

## Review

Default structure for review documents:

- **Cover (`README.md`)**
  - **Before and after:** real screenshots, live `preview` / `flow` blocks, or code of the change, first thing on the page.
  - **Intro paragraphs:** what changed for the end user, and why.
  - **Pages section:** a bulleted list linking each page for an affected flow, with one sentence on what changed.
- **Pages (`01-<slug>.md`, …), one per affected flow**
  - **Intro:** brief, simple explanation of how the flow worked before, and what changed.
  - **User flows:** the flow before and after, as numbered steps.
  - **Media:** a diff, such as an interactive `services diff` or `callstack` diff.
  - **Changes card:** a `changes` fence naming the commit or range, with the files to review in order.

A review only describes real commits. Say whether the change is local, merged, or released. If you are diagnosing a bug, use the same structure: the expected flow is "before" and the actual flow is "after".

## Thinking about software and diagrams

Think of any program as event-driven services. Messages come in with payloads, services process them, update their own state, and send messages on. A service can also contain sub-services and forward messages inside itself.

Every technical view looks at this model at one zoom level—**between services** or **inside one service**—and shows either **every path** (static shape) or **one message** (dynamic trace):

| Zoom level             | Shape: every path                                                                    | Trace: one message                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **Between services**   | `mermaid` flowchart: which services exist, who owns what, and the paths between them | `services`: one message crossing services step by step, with the state each step changes |
| **Inside one service** | Code and types: the service's state shape, message payloads, and logic               | `callstack`: how one service turns one message into a result                             |

How to pick the right view:

- **Stay zoomed out** (`mermaid` flowchart, `services`) when each service's internal work is plain and the route between services is the point.
- **Zoom in** (`callstack`, code and types) when the reader already knows which services take part and the work inside one service is what matters or changes.
- **Choose between `services` and `callstack` by how the parts talk.** Use `services` when parts keep state after handling a message, run at the same time, or send one message to many (fan out). Use `callstack` when parts are function calls that return values, branch, or return early.
- **Use lighter Mermaid views when state does not need stepping through.** Mermaid sequence diagrams trace messages when state changes are not the point, and Mermaid state diagrams show one service's lifecycle.
- **Keep one zoom level small.** Show at most about 7 services in one `services` view, and about 12 rows in one `callstack`. When a flow needs more, collapse a service's sub-services into one box and explain its inside in a separate view.
- **Put UI and lists at the reader's level.** When a person interacts with screens, show visual mocks with `preview` and `flow` blocks (or screenshots and recordings when stories are not practical). When the content is already a sequence or set of items, use a numbered or bulleted list instead of a diagram.
- **Use built-in blocks before `html`.** Reach for `services`, `callstack`, `mermaid`, a table, or `preview` first. Use an `html` block only for a visual none of them can draw.
- **Add `diff` to show a change.** Add `diff` after `services` or `mermaid`, or mark rows in `callstack`, starting lines with `-` (before only), `+` (after only), or a space (both). For code or prose patches, use a `diff` fence. Title blocks with `[Title]` after the fence name.

### Diagram syntax

Each block has its own page of syntax and examples. Read the page before you write that block:

- `npx product-doc guide services`: `services` diagrams, their state shapes (values, `text`, and `table`), and `diff`.
- `npx product-doc guide callstack`: `callstack` rows, nesting, and diffs.
- `npx product-doc guide mermaid`: Mermaid flowcharts, sequence and state diagrams, and links to source.
- `npx product-doc guide code`: code blocks with highlights and notes, and `changes` cards.
- `npx product-doc guide previews`: `preview` and `flow` blocks, mock components, and the one-time app setup.
- `npx product-doc guide ui`: screenshots, recordings, and galleries for UI that has no stories.

## Committed work

When a phase or change is committed:

1. Commit the code. Use `<base>..<head>` for a multi-commit phase.
2. End the page with a `changes` card that names the commit and lists the files to review in order (`npx product-doc guide code`).
3. Point changed references on the page at the commit (`[[a1b2c3d:src/request.ts#L8-L20]]`), update visuals to match what shipped, mark a phase title `✅`, and commit the document update separately.

## Files, serving, and references

A document is a directory at `.diffmap/specs/<short-kebab-case-name>/`. Reuse the effort's existing directory as understanding, plans, and work evolve.

```text
.diffmap/specs/<name>/
  README.md                 cover: first # Heading is the document title
  01-<topic-slug>.md        two-digit number sets order; slug is its URL
  02-<topic-slug>.md
  media/<topic-slug>/       screenshots and recordings for that page
```

Link between pages with relative file links, such as `[Phase 1](01-sign-in.md)`. To insert a page, `git mv` later pages to new numbers. `product-doc` succeeds Diffmap (`generate-diffmap` and `generate-product-doc` coexist temporarily; keep `.diffmap/specs/` paths).

Run from the repo root:

```sh
npx product-doc validate .diffmap/specs/<name>/ # check syntax, diagrams, notes, and page names
npx product-doc list                            # reuse the URL if already served
npx product-doc serve .diffmap/specs/<name>/
npx product-doc share .diffmap/specs/<name>/    # only when asked; prints https://diffmap.dev/g/<id>
```

Fix validation errors before handing back the viewer. Inspect rendered desktop and narrow layouts, step through diagrams and flows, and verify source links. Leave the server running and give the user the directory and URL. To read a served page as an agent, request its viewer URL with `Accept: text/markdown`; you get the page's Markdown source.

Source reference syntax (paths relative to repo root):

- `[[path/to/file.ts#symbolName]]` links a TypeScript or JavaScript declaration (`[[src/store.ts#Store.save]]` when ambiguous).
- `[[path]]` links a file; `[[path#L12-L30]]` links a line range.
- `[[<sha>:path#L12-L30]]` (or `<base>..<head>`) links lines after that commit; find them with `git show <sha> -- <path>` and `git show <sha>:<path> | nl -ba`.
- Write planned symbols as plain text, not broken source references.

Fences: `mermaid`, `services` (values, `text`, and `table`; add `diff` after either to mark lines `-` or `+`), `callstack`, `preview`, `flow`, `changes` (empty for uncommitted changes), and `html` (trusted HTML you wrote). Other languages are code and types.

## Feedback

When Productdoc gets in your way or the user has feedback on it, search first and comment on a matching issue instead of opening a duplicate:

```sh
gh issue list --repo tanishqkancharla/diffmap --search "<keywords>" --state all
gh issue create --repo tanishqkancharla/diffmap --title "<summary>" --body "<details and footer>"
gh issue comment "<issue-number>" --repo tanishqkancharla/diffmap --body "<details and footer>"
```

Keep titles, bodies, and comments de-identified and prose-only (no PII, code or spec snippets, raw logs, screenshots, credentials, private paths, repository/customer names, or links). End with:

```text
Reported via Productdoc agent feedback
Productdoc version: <version>
Agent: <product name>
```

Add `--label agent-feedback` when creating an issue if available. Give the user the issue URL.

## Look up the rest

- Full reference and fence syntax → [productdoc README](https://github.com/tanishqkancharla/diffmap#link-call-stacks-to-source-changes)
- Worked examples → [annotations](https://github.com/tanishqkancharla/diffmap/blob/main/fixtures/annotations/README.md), [diagrams](https://github.com/tanishqkancharla/diffmap/blob/main/fixtures/references/README.md), [services](https://github.com/tanishqkancharla/diffmap/blob/main/fixtures/services/README.md), and [media](https://github.com/tanishqkancharla/diffmap/blob/main/fixtures/media/README.md) fixtures
