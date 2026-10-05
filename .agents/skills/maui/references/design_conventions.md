# Maui design conventions

Prefer the Maui skill for composition knowledge: how to assemble tokens, components, patterns, and apps. Read every matching reference linked from `SKILL.md` before designing or implementing UI, and reuse its structure, tokens, and interactions. Reach for package source under `"maui/src/patterns"`, `"maui/src/apps"`, or an installed `node_modules` package only when the references do not cover a needed detail.

Patterns, demo apps, and the gallery `Panel` preview frame are not package components. `Panel` is not on the `"maui"` barrel, in `src/components`, or in the JSX editor catalog. Rebuild reference recipes with barrel exports such as `Button`, `Flex`, and `text(...)`.

## Composition

- Hover backgrounds have no transitions. Hover fills such as `backgroundColor.elementHover`, quiet-button washes, and list or row highlights snap instantly. Do not animate `background` or `background-color` on hover with `motion.standard(...)` or a CSS `transition`. Other motion, including tooltips and transforms, is allowed.
- Simple apps default to a prose column: `style(proseContainerStyle, { width: "100%", marginInline: "auto" })`. `sizing.contentWidth` is that same style. Use it for single-column tools, settings, forms, and reading layouts. Multi-pane or full-bleed apps such as inboxes, calendars, and IDEs are exceptions.
- Design an intentional empty composition for every list, inbox, search result, or collection. Include copy and, when useful, an action. Do not leave a blank panel.

## Shadows

Use `shadow.control` for interactive control surfaces. It combines two inset
highlights with a compact outer edge. Use the three-level elevation scale for
other raised surfaces:

- `shadow.subtle` — cards and ordinary raised surfaces
- `shadow.medium` — tooltips and larger floating panels
- `shadow.strong` — dropdowns, popovers, and dominant overlays

All three include a 1px ring. Do not also apply `border()`, `borderColor.outline`, or another ring to the same element.

Buttons and form-control surfaces use `shadow.control` by default. For compound controls, apply it once to the outer control boundary instead of to every internal button or segment.

## Focus

`focusRing()` applies a theme-aware Radix blue shadow with a `blueAlpha[8]` hard edge and `blueAlpha[5]` glow. Do not add a competing outline or box shadow for keyboard focus.

## Layout utilities

`Flex` and `Gap` take spacing scale steps (`1 | 2 | 3 | 4 | 6 | 8 | 12 | 16`), not raw pixels. For example, `<Flex row gap={4} padding={4}>` has a 9px gap and 9px inset.

Put padding on `Flex` with `padding` or `p`, `px`, `py`, `pt`, `pr`, `pb`, and `pl`; there is no `Padding` component. `alignItems` and `justifyContent` use the same tokens as `flex()` (`start`, `center`, `end`, and others; `justifyContent` also supports `between`, `around`, and `evenly`). `background` is a surface token such as `app`, `element`, or `accent`. `Spacer` grows to fill leftover flex space. `Divider` is a horizontal rule.

## Icons

Import named icons so unused SVGs are tree-shaken. Import the `Icons` namespace only when the app needs the full set.

```ts
import { Search, Plus } from "maui"
import { Text as TextIcon } from "maui/icons"

<Search size="sm" />
<TextIcon size="md" />
```

`size` uses the same t-shirt scale as `text(...)` (`2xs`–`xl`, default `sm`). Stroke and fill use `currentColor`. Icons whose root export names collide with components (`Text`, `Badge`, `Switch`, `H1`, `H2`, `H3`, `Link`, `Menu`, `Code`, `Blockquote`, `Padding`, `SearchField`) use names such as `TextIcon` and `BadgeIcon` from `"maui"`, or their original names from `"maui/icons"` or `Icons.Text`.
