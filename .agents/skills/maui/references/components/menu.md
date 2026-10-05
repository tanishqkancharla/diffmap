# Menu

Gallery: `/components/menu`. Import from `"maui"`. Related: [select.md](select.md).

Exactly two children on `MenuTrigger`: **trigger**, then **menu**. Use Maui `Button` as the trigger — it consumes React Aria `ButtonContext` / press, so the menu opens on click, Enter, Space, and Arrow keys.

```tsx
<MenuTrigger placement="bottom start">
  <Button>Actions</Button>
  <Menu onAction={(key) => doAction(String(key))}>
    <MenuItem id="rename">Rename</MenuItem>
    <MenuItem id="delete">Delete</MenuItem>
  </Menu>
</MenuTrigger>

<MenuTrigger>
  <Button variant="quiet" aria-label="Actions">
    <DotsHorizontal />
  </Button>
  <Menu>
    <MenuItem>Rename</MenuItem>
  </Menu>
</MenuTrigger>
```

`isDisabled` on the trigger button blocks open. Escape closes and focus returns to the trigger (`aria-expanded` tracks open state). While open, the Maui `Button` keeps its active fill from RAC `data-pressed` / `aria-expanded`.

`placement` defaults to `"bottom start"`. Popover uses `shadow.strong` via `CollectionPopover`.
