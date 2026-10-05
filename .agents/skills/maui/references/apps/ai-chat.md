# AI chat

Gallery: `/apps/ai-chat`. Not on the `"maui"` barrel. Prefer this layout; rebuild with barrel components. Package source: `"maui/src/apps/AiChat/"` if you need a detail this file does not cover.

Uses [MarkdownEditor](../components/editor.md) from `maui/markdown-editor` (install its optional TipTap peers), [Assistant message](../patterns/assistant-message.md), [Thinking](../components/thinking.md).

Column shell: outline border, `radius.lg`, `minHeight` ~560px / `maxHeight` ~720px, `overflow: hidden`.

```
[ scrollable feed: user bubbles + assistant rows ]
[ composer: MarkdownEditor in a raised shell + send ]
```

**Feed** (`role="log"` `aria-label="Conversation"` `aria-relevant="additions"`)

- `Flex column` with `px={8} py={6} gap={6}`, `flex: 1`, `overflowY: auto`. Scroll to bottom when messages change.
- **User**: `justifyContent: end`, bubble `maxWidth: 80%`, `prose("sm")` paragraph, `radius.md`, `shadow.subtle`, `background.element`, `pre-wrap`.
- **Assistant**: full-width column.
  1. Optional tool-call lines (lowContrast, ellipsis): `Read path`, `Wrote path`, `$ command` (command in `monospace`).
  2. AssistantMessage `size="sm"` `isAnimating={streaming}` — override `maxWidth: none` so it fills the pane.
  3. While streaming, a muted `Thinking` + “Thinking” (`xs` / lowContrast, row `gap` 4).

**Composer**

- Outer `Flex` with `px={6} pt={4} pb={6}`.
- Inner shell: `radius.lg`, `shadow.subtle`, `background.element`, `Flex column` with `px={4} py={3}`.
- `<MarkdownEditor size="sm" onSubmit={send} editable={!streaming} placeholder="Message the assistant…" />`
- Keep a TipTap instance ref on `MarkdownEditor`; after accepting a submission,
  call `composerRef.current?.commands.clearContent(false)` and `setDraft("")`.
  `onChange={setDraft}` captures edits; do not feed draft updates back as content.
- Send: circular quiet-ish `Button` (`radius.circle`, no box-shadow, `gray[3]` fill so it reads on `element`), icon `ArrowUp`, `aria-label="Send"`, disabled while streaming or empty. ⌘/Ctrl+Enter also sends (`MarkdownEditor onSubmit`).

Mock streaming (no model required for a demo): wait ~3s (Thinking), optionally emit tool-call rows, then append markdown in small chunks. Keep `animated` on Streamdown the whole time; only `isAnimating` flips off when the last chunk lands.

Empty conversation: still show a welcome **assistant** markdown message, not a blank feed.
