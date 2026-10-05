# Layout utilities

Gallery: `/components/layout-utilities`. Import from `"maui"`. Layout tokens: [tokens.md](../tokens.md).

Gallery-only: `Panel` is a dotted preview frame in the docs site (`src/pages/Panel.tsx`). It is **not** a `"maui"` export (barrel or `src/components`). Use `Flex` + `shadow` + `radius` instead.

## `Flex`

Row **or** column (exactly one of `row` / `column` is required).

```tsx
<Flex row gap={4} alignItems="center" justifyContent="between">
  <Avatar name="Ada Lovelace" size="md" />
  <Text size="lg" fontWeight={600}>
    Ada Lovelace
  </Text>
  <Badge>Active</Badge>
</Flex>
```

| Prop                          | Notes                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `row` / `column`              | Required, mutually exclusive                                                                |
| `gap`                         | Spacing step                                                                                |
| `p` / `padding`               | All-side padding step                                                                       |
| `px` `py` `pt` `pr` `pb` `pl` | Axis / side padding                                                                         |
| `alignItems`                  | `start` \| `center` \| `end` \| `stretch` \| `baseline` — same tokens as `flex()`           |
| `justifyContent`              | `start` \| `center` \| `end` \| `between` \| `around` \| `evenly` — same tokens as `flex()` |
| `background`                  | `app` \| `element` \| `elementHover` \| `elementActive` \| `accent` \| `accentHover`        |
| `border`                      | `true` (outline) or `"border" \| "outline" \| "accent"`. **Skipped when `shadow` is set**   |
| `shadow`                      | `"subtle" \| "medium" \| "strong"` — includes a ring; do not also set `border`              |
| `radius`                      | Token key (`sm`, `lg`, `pill`, …)                                                           |
| `style`                       | React style object                                                                          |

Do not wrap children in a `Padding` box — that component does not exist. Use `Flex` padding props.

## `Gap`

Fixed spacer: `{ width: Space }` **or** `{ height: Space }`. Does not grow.

## `Spacer`

`flex: 1 1 auto` — fills leftover space in a `Flex`.

## `Divider`

Full-width `<hr>` (`gray[5]`, 1.5px). Has vertical margin (~1.5rem). For tight lists, prefer `gap: 1px` between rows instead.

## `navigationItem`

Style object (not a component) for current-page nav rows: sm text, `radius.sm`, hover `elementHover`, `[aria-current="page"]` accent + weight 500. Used by the [Sidebar](../patterns/sidebar.md) recipe.
