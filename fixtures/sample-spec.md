# Spec fixture

## System flow

```mermaid
flowchart TD
  A[Spec markdown] --> B[Local page]
  B --> C[Implementer]
```

## Problem overview

Specs lived as markdown files with no local page, so mermaid, call stacks, and diff previews were hard to read. Prose may name paths such as `{workspace}/.halo/extensions/<id>/`.

## Solution overview

`pnpm exec tkstack` serves the spec with the same Maui page as a code walkthrough. The spec keeps its own section shape.

## Goals

- A spec file in `specs/` opens as a local page.
- Mermaid, types, call stacks, and diff previews render on that page.

## Non-goals

- Changing the spec section order.

## Important files, docs, and websites

- [`src/cli.ts`](../src/cli.ts) — Starts the local server for both specs and walkthroughs.

## Implementation

### Phase 1: Serve the spec file

The CLI already parses markdown. Point it at a spec path. `startServer` now builds the Vite page instead of writing walkthrough HTML:

```callstack
 startServer
-└── readWalkthroughOnly
+└── createViteServer
    └── handleTkstackRequest
```

`StartServerInput` is the listen contract: file, workspace root, and port.

```ts
// src/serve.ts
type StartServerInput = {
  filePath: string;
  workspaceRoot: string;
  port: number;
};
```

The CLI description covers both specs and walkthroughs.

```diff
 // src/cli.ts
 Cli.create("tkstack", {
-  description: "Serve a walkthrough",
+  description: "Serve a spec or code walkthrough markdown file as a local page",
```

- [ ] Add a `pnpm spec` alias that runs the same CLI.
- [ ] Teach generate-spec to serve `specs/<name>.md` after writing it.
- [ ] Smoke that mermaid and diffs render. Delete any harness. Do not commit this check.
- [ ] Run `pnpm --filter tkstack typecheck`.
