# List box

Gallery: `/components/list-box`. Import from `"maui"`.

Persistent selectable list (not a popup). Wrap in a raised, padded panel.

```tsx
<ListBox
  aria-label="Inboxes"
  selectionMode="single"
  selectedKeys={keys}
  onSelectionChange={setKeys}
  disallowEmptySelection
>
  <ListBoxItem id="inbox">Inbox</ListBoxItem>
  <ListBoxItem id="sent">Sent</ListBoxItem>
</ListBox>
```

Hover/focus uses `elementHover` with **no** background transition. Selected: accent text + trailing ✓.

`textValue` is inferred from string children; pass it when children are not a string.
