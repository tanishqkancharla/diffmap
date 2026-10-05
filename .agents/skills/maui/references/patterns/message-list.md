# Message list

Gallery: `/patterns/message-list`. Not on the `"maui"` barrel. Prefer this recipe; rebuild with barrel components. Package source: `"maui/src/patterns/MessageList.tsx"` if you need a detail this file does not cover.

`MessageList` + `Message`: raised **cards** in a column (`gap` 6, max width ~760px), `role="feed"`.

Each `Message`:

```tsx
<article>
  {" "}
  {/* radius.lg, shadow.subtle, padding 8, column gap 4, background.element */}
  <header>
    {" "}
    {/* row, wrap, gap 2 */}
    <Avatar name={sender} size="sm" />
    <Text size="sm" fontWeight={500}>
      {sender}
    </Text>
    <time>
      <Text size="xs" color="lowContrast">
        {timestamp}
      </Text>
    </time>
    {edited ? (
      <Text size="xs" color="lowContrast">
        (edited)
      </Text>
    ) : null}
  </header>
  <Prose>{/* body: P / lists, not a raw string */}</Prose>
</article>
```

- `sender` + `timestamp` required; `edited?` appends “(edited)”.
- Body is React children inside `Prose` (so headings/paragraphs get reading rhythm). For email, keep the inner `Prose` unconstrained (`minWidth: 0`) so it fills the card.
- Empty thread: “Select a thread to read messages.” See [Email client](../apps/email-client.md).
