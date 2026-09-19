# diffmap

<img width="2031" height="1212" alt="Screenshot 2026-09-10 at 10 41 03 AM" src="https://github.com/user-attachments/assets/8650f8be-44ca-4c21-b9bf-4ce938b4083e" />

diffmap is a set of personal skills as well as a web-viewer for Markdown files. It has a unique form of showing diffs using a mixture of callstack diffs and mermaid diagram links, which I've found to be personally extremely helpful in understanding massive diffs.

```sh
npx @tanishqkancharla/diffmap serve path/to/file.md
```

Bare `npx @tanishqkancharla/diffmap path/to/file.md` is the same as `serve`.

Share a secret gist and print a `diffmap.dev` link (requires [`gh`](https://cli.github.com/) logged in). Does not start a local server:

```sh
npx @tanishqkancharla/diffmap share path/to.md
```

Hosted viewer: `https://diffmap.dev/g/<gistId>` (optional `/<file.md>`; `#heading` is the table of contents). The page fetches the gist in the browser from `api.github.com`. Gists are unlisted, not private.

## Agent skills

```sh
npx skills add tanishqkancharla/diffmap --skill generate-spec
```

Keeps a spec in `specs/` that stays true to what's planned versus already in the tree. Serve it with diffmap. Share from a GitHub PR (`https://diffmap.dev/<owner>/<repo>/pull/<n>/specs/<name>.md`) or `npx @tanishqkancharla/diffmap share`.

Options:

- `--port <n>` — pin a listen port (default: a free port)
- `--root <dir>` — workspace root for file excerpts (default the directory you ran the command from)

**Close server** in the top right stops the server. Hosted gist and GitHub viewers have no local server, so they omit this control.

The server also stops after 24 hours without a page or source request.
Loading or refreshing the page resets the timer; background health checks and
Vite connections do not keep it alive.

List every running viewer, including viewers using custom ports:

```sh
npx @tanishqkancharla/diffmap list
```

Request the page with `Accept: text/markdown` to read the current source file
instead of the rendered HTML. Use the URL printed by `serve`:

```sh
curl -H 'Accept: text/markdown' http://127.0.0.1:<port>/
```

## Library

```ts
import {
  startServer,
  parseFence,
  parseViewerDocument,
} from "@tanishqkancharla/diffmap";
```

`parseViewerDocument` turns markdown into the page document with [md4x](https://github.com/unjs/md4x). `startServer` listens. The generate-spec skill owns document shape; the viewer does not.

## Fences

| Fence info string                              | Viewer                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `mermaid`                                      | Beautiful Mermaid                                                                                 |
| `callstack` or `diff` containing `└──` / `├──` | Interactive stack rows, no file header                                                            |
| `diff` or `diff:path` with a file path         | Pierre patch with Pierre’s file header                                                            |
| `diff` with no path                            | Pierre patch, no file header                                                                      |
| `start:end:path`                               | Pierre file excerpt with Pierre’s file header                                                     |
| `html`                                         | Trusted HTML from this file. diffmap does not sanitize it. Only use it for local files you wrote. |
| other langs                                    | Maui `CodeBlock`                                                                                  |

Fences keep whitespace. Use them for mermaid, call stacks, and diffs.

## MDC

md4x Comark components map to the same views:

```md
::mermaid
flowchart TD
A --> B
::

::callstack
startServer
+└── createViteServer
::

::diff{path="src/cli.ts"}
--- a/src/cli.ts
+++ b/src/cli.ts
::

::file{path="src/cli.ts" start="1" end="20"}
::

::html
<aside>Note.</aside>
::
```

`.md` and `.mdx` are both markdown. Curly braces in prose are plain text.

## Link call stacks to source changes

Append `[[path/to/file.ts#symbolName]]` to a call stack line to link a symbol.
Paths are relative to `--root`. Symbol lookup supports TypeScript and JavaScript
declarations, including qualified names such as `[[src/store.ts#Store.save]]`.
Ambiguous names show the qualified names you can use instead.

```callstack
 handleRequest [[src/request.ts#handleRequest]]
+└── validateInput # reject invalid input [[src/validation.ts#validateInput]]
```

The panel highlights the declaration in the current workspace file. If an
included source patch overlaps that declaration and its new-side text matches
the workspace, the panel highlights the patch instead. Symbol references do not
require a `source-diff` fence. Use `[[path/to/file]]` for a whole file or
`[[path/to/file#L12-L30]]` for a file range; these work with other languages too.

To reference an exact change, including removed code, use the patch syntax below.
Symbol names resolve against current files; use an `old` reference for a deleted
symbol or a historical version.

Append `[[id:side:start-end]]` to a call stack line. `side` is `old` or `new`;
line numbers refer to that version of the source file, not the patch. A single
line can use `[[id:new:12]]`. Multiple references on one stack line are allowed.
The references are hidden in the rendered stack, and linked rows support mouse
clicks and keyboard activation.

Define each ID once in a `source-diff:id:path` fence anywhere in the document.
Copy the file's actual Git patch, including its `diff --git`, file headers, and
`@@` hunk headers. Keep enough context to explain the change. Each reference
range must fit within one included hunk. Use the new path for renamed files and
the old path for deleted files.

````md
```callstack
 handleRequest
-└── saveUnchecked [[request:old:12]]
+├── validateInput # reject invalid input [[request:new:12-13]]
 └── saveRecord
```

```source-diff:request:src/request.ts
diff --git a/src/request.ts b/src/request.ts
--- a/src/request.ts
+++ b/src/request.ts
@@ -10,5 +10,6 @@
 export function handleRequest(input: Input) {
   const record = input.record;
-  saveUnchecked(record);
+  const error = validateInput(record);
+  if (error instanceof Error) return error;
   return saveRecord(record);
 }
```
````

References open in one shared panel beside the walkthrough. Selecting a stack
line or diagram element highlights it and scrolls the panel to the linked code
range. When a target has several references, buttons above the source viewer
select among them. On narrow windows the source panel sits below the walkthrough.
Documents without references or source patches keep the single-panel layout.

Unknown IDs, duplicate definitions, malformed references, mismatched paths, and
ranges outside the included hunks produce a parse error. Source patches are
embedded snapshots; the viewer does not regenerate them from the working tree.

Cmd-click (or Ctrl-click) a TypeScript or JavaScript symbol in the source panel
to open its definition. Use Back to retrace navigation and return to the reference.
Resolution uses the workspace's TypeScript configuration and current files.
Deleted files and lines that no longer match the workspace show a message;
their call stack references still highlight the embedded old-side diff.

Run `npx @tanishqkancharla/diffmap fixtures/annotations.md` for an example
with old/new references, multiple files, and unchanged context.

## Link Mermaid nodes and edges

Inside a Mermaid fence, add `%% ref node:<id> [[reference]]` to link a node or
participant, or `%% ref edge:<index> [[reference]]` to link an edge or sequence
message. Edge indices start at zero in declaration order. The same file, symbol,
and old/new patch references work here. Keep one directive per target; append
multiple references to that directive when needed.

````md
```mermaid
flowchart LR
  A[Request] -->|Validate| B[Validation]
  %% ref node:A [[src/request.ts#handleRequest]]
  %% ref node:B [[src/validation.ts#validateInput]]
  %% ref edge:0 [[request:new:12-13]]
```

```mermaid
sequenceDiagram
  participant App
  participant Store
  App->>Store: Save record
  %% ref node:Store [[src/store.ts#Store]]
  %% ref edge:0 [[src/store.ts#Store.save]]
```
````

Click a linked shape, edge line, or edge label, or focus it with Tab and press
Enter or Space. Directives are Mermaid comments, so they remain hidden and do
not change the diagram when rendered by other Mermaid tools. Missing diagram
targets display an error. See [the runnable example](fixtures/references.md).
