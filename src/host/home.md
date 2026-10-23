# diffmap

A viewer for specs and walkthroughs. Call stacks, mermaid that links into source, and a Diff panel. This page is one — `parseViewerDocument` plus `ViewerApp`, same path as `diffmap serve`.

TOC on the left, article here, Diff on the right. Click a stack row or a mermaid node.

## Install the skill

```sh
npx skills add tanishqkancharla/diffmap --skill generate-diffmap
```

That keeps a living spec in `specs/<name>.md`. Same file for the life of the work: what’s already in the tree, and what’s still planned. Don’t start a second walkthrough later.

## Serve locally

```sh
npx @tanishqkancharla/diffmap serve specs/<name>.md
```

Bare `npx @tanishqkancharla/diffmap specs/<name>.md` is the same as `serve`. `list` shows running viewers — reuse the URL instead of starting a second server.

**Close server** is only on that local page. This host has no process to stop.

## Share

### Gist

```sh
npx @tanishqkancharla/diffmap share specs/<name>.md
```

Prints `https://diffmap.dev/g/<gistId>` (optional `/<file.md>`). Secret gist: unlisted, not private. Anyone with the id can read it. Does not start a local server.

### GitHub PR vs commit

A spec on a public PR:

`https://diffmap.dev/<owner>/<repo>/pull/<n>/specs/<name>.md`

Pinned commit:

`https://diffmap.dev/<owner>/<repo>/commit/<sha>/specs/<name>.md`

The pin is one SHA. The markdown and every `[[path]]`, mermaid `%% ref`, and excerpt load from that commit, not `main`. Commit references load their diffs from the GitHub API. A PR number only chooses the SHA (head at load, then pin). Refresh stays on the commit URL.

## What the fences are

### System flow

Click a node. `%% ref` is a mermaid comment; `[[path]]`, `[[path#symbol]]`, and `[[<sha>:path#L12-L30]]` are the same references as on a stack row.

```mermaid
flowchart LR
  Spec[Living spec] --> Serve[serve]
  Spec --> Share[share]
  Spec --> Pin[GitHub pin]
  %% ref node:Spec [[src/parseViewer.ts#parseViewerDocument]]
  %% ref node:Serve [[src/cli.ts]]
  %% ref node:Share [[src/share.ts#shareMarkdownFile]]
  %% ref node:Pin [[src/github/route.ts]]
  %% ref edge:0 [[1257fe8:src/cli.ts#L49-L50]]
```

````md
```mermaid
flowchart LR
  Spec[Living spec] --> Serve[serve]
  %% ref node:Serve [[src/cli.ts]]
```
````

### Call stacks

`-` is current, `+` is proposed. After a phase lands, commit it and retarget `[[path]]` to the commit: `[[<sha>:path#L12-L30]]`. Line numbers are the file after the commit.

```callstack
 ViewerApp
-└── DoneButton  # a loud Done control
+└── CloseServerButton  # quiet, local mode only [[dae6b98:src/viewer/ViewerApp.tsx#L219-L227]] [[dae6b98:src/viewer/CloseServerButton.tsx#L8-L16]]
     └── DiffButton
```

```callstack
 shareMarkdownFile [[src/share.ts#shareMarkdownFile]]
-└── print the gist URL
+└── gistViewerUrl  # https://diffmap.dev/g/<id> [[d14ae1a:src/share.ts#L55-L59]]
```

### Changes

A `changes` fence names a commit. It renders a card with every file that commit changed. **Review** opens the Diff panel on all of them, with a sticky header per file; a row jumps to its file. An empty body means uncommitted changes.

```changes
dae6b98
```

Commit references must name a file the commit changed, and the range must fit the file after the commit. `serve` and `share` check this at startup.

### File excerpts

`start:end:path`. Locally the server reads the workspace file. Here the bundled file is sliced the same way.

```58:72:src/cli.ts
const cli = Cli.create("diffmap", {
  description: "Serve a spec locally, or share it as a gist",
  version: packageVersion,
  args: serveArgs,
  options: serveOptions,
  output: serveOutput,
  hint: "`serve <spec.md>` runs the local viewer. `share <spec.md>` publishes a secret gist. `update` (or `--update`) installs the latest diffmap.",
  examples: [
    {
      args: { file: "spec.md" },
      description: "Same as `diffmap serve spec.md`",
    },
  ],
  run: runServe,
})
```

### HTML

Local `serve` trusts `html` in the file you pointed at. This host does not. Gist and GitHub pages are the same — no `dangerouslySetInnerHTML` from untrusted markdown.

```html
<aside>If this renders, the host leaked HTML.</aside>
```

## How a spec stays alive

Write `specs/<name>.md`. Serve it while you plan. When the plan changes, edit this file. When a phase lands, commit it, add a `changes` fence, and retarget the links to the commit so the Diff panel opens the change, not just the file.

### Phase 1: Spec and serve

```callstack
 generate-diffmap
 └── specs/name.md
     └── diffmap serve [[src/cli.ts]]
```

- [x] Install the skill.
- [x] Keep one living spec.
- [x] `diffmap serve` / `list`.

### Phase 2: Share it

```callstack
 specs/name.md
-└── localhost only
+├── diffmap share [[d14ae1a:src/share.ts#L55-L59]]
+└── GitHub PR URL [[src/github/route.ts]]
```

- [x] Gist URL for a snapshot.
- [x] PR URL when the spec lives in the repo (pin to one SHA).
