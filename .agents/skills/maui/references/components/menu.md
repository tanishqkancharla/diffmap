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

`isDisabled` on the trigger button blocks open. Escape closes and focus returns to the trigger (`aria-expanded` tracks open state).

`placement` defaults to `"bottom start"`. Popover uses `shadow.strong` via `CollectionPopover`.

## Context menus

Use `trigger="contextMenu"` with the same `Menu` and `MenuItem`. Wrap custom targets in [Pressable](../interactions/pressable.md); its interaction reference covers target requirements and ordinary menu triggers. Maui `Button` already integrates with React Aria and needs no `Pressable` wrapper.

```tsx
import { MenuTrigger, Menu, MenuItem, Pressable } from "@tanishqkancharla/maui";

<MenuTrigger trigger="contextMenu">
  <Pressable>
    <div role="button" tabIndex={0}>
      Report.pdf
    </div>
  </Pressable>
  <Menu aria-label="File actions" onAction={(key) => doAction(String(key))}>
    <MenuItem id="rename">Rename</MenuItem>
    <MenuItem id="delete">Delete</MenuItem>
  </Menu>
</MenuTrigger>;
```

React Aria handles right-click, touch long-press, and OS/screen-reader context-menu commands (for example Shift+F10 on Windows/Linux or Control+Enter on macOS). Keep a visible Actions button offering the same actions; context menus are an enhancement, not the only entry point. Preserve native context menus on editable content and links when users need browser actions.

The current popup still uses `CollectionPopover` defaults: a 6px offset and minimum width equal to the target width. Use a compact target when that sizing is appropriate. See [React Aria's context-menu documentation](https://react-aria.adobe.com/Menu#context-menu) for interaction details.

## Styles

**Menu** — `menuStyles`

- `root` — RAC `Menu`, inside `CollectionPopover`.
- `item` — RAC `MenuItem`; `data-hovered`, `data-focused`, `data-selected`, `data-disabled`, `data-has-submenu`.
