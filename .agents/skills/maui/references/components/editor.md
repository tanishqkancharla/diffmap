# Editor

Gallery: `/components/editor`. Composer chrome: [AI chat](../apps/ai-chat.md).

Two unchromed surfaces: `Editor` renders a caller-owned TipTap instance;
`MarkdownEditor` creates one with Markdown defaults. Wrap either for padding,
elevation, and actions. Both require `MauiProvider` as usual.

## Installation and imports

TipTap is an **optional peer dependency**. Non-editor consumers do not need it.
Editors are separate entry points, not exports of the main Maui barrel.
Examples use the published package name; if installed under the `maui` alias,
use `maui/editor` and `maui/markdown-editor` instead.

For `Editor`, install TipTap's React runtime and whichever extensions you use:

```sh
npm install @tiptap/core@^3.29.2 @tiptap/react@^3.29.2 @tiptap/pm@^3.29.2
# Optional starting schema for your editor:
npm install @tiptap/starter-kit@^3.29.2
```

For `MarkdownEditor`, install all six peers:

```sh
npm install @tiptap/core@^3.29.2 @tiptap/react@^3.29.2 @tiptap/pm@^3.29.2 @tiptap/starter-kit@^3.29.2 @tiptap/markdown@^3.29.2 @tiptap/extension-placeholder@^3.29.2
```

Keep the TipTap packages on matching versions to avoid duplicate or incompatible
editor runtimes. Do not rely on Maui's development dependencies being installed.

## Editor: native TipTap configuration

```tsx
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Editor } from "@tanishqkancharla/maui/editor";

function CustomEditor() {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: "<p>Start writing…</p>",
    immediatelyRender: false,
    editorProps: { attributes: { "aria-label": "Document" } },
    onUpdate: ({ editor }) => console.log(editor.getJSON()),
  });

  return <Editor editor={editor} size="md" />;
}
```

- Props are TipTap's `EditorContentProps`, with `size` replaced by Maui's
  `"sm" | "md" | "lg"` prose scale (default `"md"`). `editor` accepts `null`
  while `useEditor` initializes.
- No built-in extensions, schema, content synchronization, or submit shortcut.
  Use TipTap's `extensions`, `editorProps`, and lifecycle callbacks directly.
- Use `editor.commands` / `editor.chain()` for commands and `useEditorState`
  from `@tiptap/react` for reactive toolbar state. Custom nodes and React node
  views use TipTap's normal APIs; Maui does not wrap them.
- The caller owns the instance and its lifecycle. Mounting or unmounting this
  surface does not create or destroy the caller's editor.
- `className`, `style`, refs, and other DOM props target the outer wrapper.
  Put editable-element attributes (including `aria-label`) in
  `editorProps.attributes`. Maui does not overwrite those attributes or handlers.
- TipTap's `content` is initial content, not a React controlled value. Use
  `editor.commands.setContent(...)` for subsequent external replacements.

## MarkdownEditor: Markdown in and out

```tsx
import { MarkdownEditor } from "@tanishqkancharla/maui/markdown-editor";

<MarkdownEditor
  initialContent={loadedDraft}
  onChange={saveDraft}
  onSubmit={send} // ⌘/Ctrl+Enter
  placeholder="Write…"
  size="sm" // ProseSize: sm | md | lg
  editable={!streaming}
  aria-label="Compose message"
/>;
```

- `initialContent` initializes the Markdown document once. Later prop changes
  are ignored, including delayed save responses. There is no content-sync effect.
- `onChange` receives Markdown for persistence; saving does not replace the
  active document. Wait for the initial draft to load before mounting. Use
  `key={documentId}` to start a new editing session for another document.
- `initialContent` defaults to `""`; `placeholder` to `"Write…"`; `size` to `"md"`;
  `editable` to `true`; `aria-label` to `"Editor"`.
- StarterKit supplies CommonMark shortcuts (`#`, `**`, `-`, `>`) and headings
  1–4. Links do not open on click. Markdown and Placeholder are also installed.
- `aria-label` targets the editable element; `className` targets its wrapper.
- This is an opinionated wrapper, without extension/options overrides. For
  custom schemas or behavior, compose `Editor` with TipTap's `useEditor`.
- No chrome, no submit button — parent owns those.

For deliberate changes, `ref` exposes the TipTap instance (not the wrapper DOM
element). It is `null` before initialization and after unmount:

```tsx
const editorRef = useRef<TiptapEditor | null>(null) // type from @tiptap/react

<MarkdownEditor ref={editorRef} initialContent={loadedDraft} onChange={saveDraft} />

// For example, clear after a successful chat submission:
editorRef.current?.commands.clearContent()
```

`clearContent(false)` suppresses `onChange` if the caller resets its draft state
separately. Replacing content through commands is explicit and can change the
selection and undo history; do not echo autosave responses into those commands.

## Migration

The old root-exported `Editor` was the Markdown wrapper. Rename it to
`MarkdownEditor` and change the import to `maui/markdown-editor` (or the full
package name above). Rename `content` to `initialContent`; it is no longer a
controlled value. Replace intentional prop-driven resets with explicit commands
through `ref`, or a new React `key` for a new document. Install the optional peers.
The new `Editor` is imported from `maui/editor` and requires an editor instance.
