# Sidebar

Gallery: `/patterns/sidebar`. Not on the `"maui"` barrel. Prefer this recipe; rebuild with barrel components. Package source: `"maui/src/patterns/Sidebar.tsx"` if you need a detail this file does not cover.

`Sidebar` / `SidebarSection` / `SidebarItem`: fixed **240px** nav: raised `background.element` + `shadow.subtle` + `radius.lg`, column `gap={8}`, padding step 2.

Uses `navigationItem` from [layout utilities](../components/layout-utilities.md).

Composition:

1. Optional brand block (not a special component).
2. One or more sections: xs/500/lowContrast label, then a list of items.
3. Each item is a full-width quiet row: 16px icon column, label, optional trailing (`Badge`).

```tsx
import { Flex, Text } from "maui";

<nav aria-label="Workspace">
  {/* 240px column, padding step 2, radius.lg, shadow.subtle, background.element, gap 8 */}
  <Flex column gap={2} px={4} pt={4}>
    <Text size="sm" fontWeight={600}>
      Maui Cloud
    </Text>
    <Text size="xs" color="lowContrast">
      Production
    </Text>
  </Flex>
  {/* sections + items — see layout rules below */}
</nav>;
```

Item layout (rebuild, do not invent a different nav row):

- Grid: `16px minmax(0, 1fr) auto`, column gap spacing 3.
- Style from `navigationItem` + `focusRing("&:focus-visible")`.
- `aria-current="page"` when `active` — accent color + weight 500, **no** filled background.
- Icon wrap is 16×16, `gray[11]`; active icon uses `accent[9]`.
- Label: 13/20, ellipsis. Section label is padded to align with the text column (padding-start = item padding 4 + 16px icon + gap 3).
- Native `<button type="button">` inside `<li>`, not `Button` — so the row can be a grid without the 28px control chrome.
- List: no bullets, `gap: 1px`.

Hover: `backgroundColor.elementHover`, instant.

Mobile overlay chrome is [`Drawer`](../components/drawer.md), a separate barrel component. Do not hang a sheet, rail, or trigger off Sidebar.
