# Maui design conventions

Use the matching skill references for Maui's design choices, composition rules, and reusable token patterns. Inspect the installed package's source for tactical questions about props, defaults, state styling, or exact values. Source ships under `node_modules/maui/src/` with the documented npm alias, or `node_modules/@tanishqkancharla/maui/src/` without it. Follow components into their token definitions as needed; current implementation is not a guarantee of contrast or design intent.

Patterns, demo apps, and the gallery `Panel` preview frame are not package components. `Panel` is not on the `"maui"` barrel, in `src/components`, or in the JSX editor catalog. Rebuild reference recipes with barrel exports such as `Button`, `Flex`, and `text(...)`.

## Components first, styles second

Use Maui components. When one can't do what you need, build from the matching `react-aria-components` element and apply that component's exported styles, such as `listBoxStyles.item` or `buttonStyles.root({ variant: "quiet" })`. Each component reference lists its parts under **Styles**. Don't copy CSS from package source.

```tsx
import { GridList, GridListItem } from "react-aria-components"
import { useStyles } from "purse-styles"
import { listBoxStyles } from "maui"

const list = useStyles(listBoxStyles.root)
const item = useStyles(listBoxStyles.item)
<GridList className={list}>
  <GridListItem className={item}>Ada</GridListItem>
</GridList>
```

State styles key off React Aria attributes (`data-hovered`, `data-selected`, `data-focus-visible`). On a plain element you get only the resting look.

## Composition

- Use Maui's `Text` component for standalone inline typography; see [Text](components/text.md). `Text` and `text(...)` set an explicit color by default, overriding inherited variant, selected, or disabled colors. Prefer plain Button labels so the Button controls its foreground. Keep semantic elements such as headings, paragraphs, labels, and links for their respective roles.
- Hover backgrounds have no transitions. Hover fills such as `backgroundColor.elementHover`, quiet-button washes, and list or row highlights snap instantly. Do not animate `background` or `background-color` on hover with `motion.standard(...)` or a CSS `transition`. Other motion, including tooltips and transforms, is allowed.
- Simple apps default to a prose column: `style(proseContainerStyle, { width: "100%", marginInline: "auto" })`. `sizing.contentWidth` is that same style. Use it for single-column tools, settings, forms, and reading layouts. Multi-pane or full-bleed apps such as inboxes, calendars, and IDEs are exceptions.
- Design an intentional empty composition for every list, inbox, search result, or collection. Include copy and, when useful, an action. Do not leave a blank panel.

## Decorative edge strips

When a rounded surface uses a colored edge for emphasis, use a full-height rectangular strip inside a `position: relative; overflow: hidden` container. Keep the radius on the container, not the strip: a CSS left border follows the corners and curls inward. This is a composition recipe for custom UI, not a new component or a change to existing component borders. Keep using `border()` for outlines and dividers.

```tsx
const surface = style(radius.md, spacing.padding({ all: 6 }), {
  position: "relative",
  overflow: "hidden",
  backgroundColor: colors.orange[3],
});
const strip = style({
  position: "absolute",
  insetBlock: 0,
  left: 0,
  width: "3px",
  backgroundColor: colors.orange[9],
  pointerEvents: "none",
});

function DecoratedSurface() {
  const surfaceClass = useStyles(surface);
  const stripClass = useStyles(strip);
  return (
    <div className={surfaceClass}>
      <div aria-hidden="true" className={stripClass} />
      <Text>Surface content</Text>
    </div>
  );
}
```

## Shadows

Use `shadow.control` for interactive control surfaces. Use the three-level elevation scale for other raised surfaces:

- `shadow.subtle` — cards and ordinary raised surfaces
- `shadow.medium` — larger floating panels
- `shadow.strong` — dropdowns, popovers, and dominant overlays

These shadows include their own edge or ring. Do not also apply `border()`, `borderColor.outline`, or another ring to the same element. Not every floating component uses elevation: reuse its exported styles rather than inferring a shadow from its placement.

Buttons and form-control surfaces use `shadow.control` by default. For compound controls, apply it once to the outer control boundary instead of to every internal button or segment.

## Focus

Use `focusRing()` for Maui's theme-aware keyboard-focus treatment rather than adding a competing outline or box shadow.

**Control safe area.** Input and form-control shadows paint outside the component's layout box; reserve room for the resting, hovered, and keyboard-focused states, even when hover does not change the background. Use `spacing.padding(4)` as a starting inset between controls and clipping edges, and leave gaps between neighboring controls. Keep overflow visible on immediate wrappers; when a panel, rounded container, or scroll viewport must clip, put the safe inset inside that clipping boundary, not outside it as margin. Check the first and last controls at scroll edges, including checkbox, radio, switch, and slider focus states. Do not remove shadows or focus rings to fit a tight layout.

```tsx
// Keep the control's visual overflow inside the scrolling boundary.
<div style={{ overflow: "auto" }}>
  <Flex column padding={4} gap={4}>
    <TextField aria-label="Name" />
    <Select aria-label="Plan">{/* options */}</Select>
  </Flex>
</div>
```

## Layout utilities

`Flex` and `Gap` take spacing scale steps, not raw pixels. For example, `<Flex row gap={4} padding={4}>` uses the same token for its gap and inset.

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
