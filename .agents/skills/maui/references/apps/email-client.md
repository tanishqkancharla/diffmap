# Email client

Gallery: `/apps/email-client`. Not on the `"maui"` barrel. Prefer this layout; rebuild with barrel components. Package source: `"maui/src/apps/EmailClient/"` if you need a detail this file does not cover.

Patterns: [Inbox](../patterns/inbox.md), [Message list](../patterns/message-list.md).

**Two panes**, full-bleed (not a `proseContainerStyle` column).

```
[ 240px inbox ] [ flexible reading pane ]
```

Shell: `radius.lg`, `shadow.subtle`, `minHeight` ~640px, `overflow: hidden`, `backgroundColor.app`, grid `240px minmax(0, 1fr)`.

**Inbox pane**

- `Flex column` with `p={2}`, `minHeight: 0`, list `overflowY: auto`.
- Header: `H3` “Inbox” (or mailbox name), padded to match multi-line row text (`pt` 6, `px` 4).
- Body: InboxMultiLine with `threads`, `selectedId`, `onSelectThread`. Reset the pattern’s default `marginTop` so it sits flush under the header.

**Reading pane**

- `Flex column` with `px={16} py={8} gap={6}`, `overflowY: auto`.
- Selected: `H2` subject, then MessageList of that thread’s messages (`sender`, `timestamp`, optional `edited`, `P` children).
- None selected: lowContrast “Select a thread to read messages.”

State: one `selectedThreadId`. Threads carry `id / senders / subject / snippet / time / unread?` plus a `messages[]` array. Unread dots and hover toolbars come from the inbox pattern.
