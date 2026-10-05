# Inbox

Gallery: `/patterns/inbox`. Not on the `"maui"` barrel. Prefer this recipe; rebuild with barrel components. Package source: `"maui/src/patterns/Inbox.tsx"` if you need a detail this file does not cover.

`Inbox` / `InboxMultiLine`: mail **thread list**, not a table. Two densities:

|        | `Inbox` (single line)                                                      | `InboxMultiLine`                                 |
| ------ | -------------------------------------------------------------------------- | ------------------------------------------------ |
| Grid   | `minmax(180px, 24%) minmax(0, 1fr) 92px` — sender · subject+snippet · time | Column: sender+time row, subject, 2-line snippet |
| Height | ~40px                                                                      | Padded `y: 6, x: 4`                              |
| Unread | 6px accent dot before sender                                               | Same, aligned to the first line                  |

Row model:

```ts
type EmailThread = {
  id: string;
  senders: string;
  subject: string;
  snippet: string;
  time: string;
  unread?: boolean;
};
```

Behavior:

- `selectedId` + `onSelectThread(id)`. Selected row uses `backgroundColor.elementActive`. Hover uses `elementHover` (instant).
- `radius.md`, `userSelect: none`, list `gap: 1px`.
- Subject: highContrast, ellipsis. Snippet: lowContrast, ellipsis (multi-line clamps to 2).
- Time sits on the right. **On hover**, time fades out and a quiet icon toolbar (`Star`, `Archive`, `Trash`, `Envelope`, `Clock`) fades in at the right — `shadow.subtle` chip, `Button variant="quiet"` with `aria-label`, `stopPropagation` on click.
- Always include an empty state when `threads.length === 0` (“No messages” + optional compose action).

Single-line sender column is highContrast with the unread dot. Multi-line puts the dot in a leading column (`alignItems: start`).

[Email client](../apps/email-client.md) uses **InboxMultiLine** in a 240px pane.
