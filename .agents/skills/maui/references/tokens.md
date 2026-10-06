# Tokens, theme, and styling

Use this file when choosing color, type, space, motion, or elevation, or when writing custom `purse-styles` around Maui components.

Import tokens from `"maui"`. Import `style` / `useStyles` from `"purse-styles"`. Prefer semantic tokens over one-off CSS variables.

## Theme

`MauiProvider` wraps `ThemeProvider` + `PurseProvider` + global CSS + the focus UI database.

```tsx
import { MauiProvider, themeFoucScript, useTheme } from "maui";

// In <head>, before React:
// <script>{themeFoucScript}</script>

const { preference, resolvedTheme, setPreference } = useTheme();
// preference: "system" | "light" | "dark"
// resolvedTheme: "light" | "dark"
```

- Storage key: `themeStorageKey` (`"maui-theme"`).
- Dark CSS: `DARK_THEME` is `:root[data-theme="dark"]`. `defineVars` dark values use that selector.
- FOUC: inline `themeFoucScript` in a classic `<script>` in `<head>` so `data-theme` and `color-scheme` exist before first paint.

`MauiProvider` also sets `box-sizing: border-box`, zeros `html`/`body` margin, paints `backgroundColor.app`, applies `baseTextStyle` (md / 400 / highContrast) on `html, body`, and resets heading/paragraph margins.

## purse-styles

Maui styles are `purse-styles` objects. `useStyles(...)` turns one or more of them into a class name.

```tsx
import { style, useStyles } from "purse-styles";
import { flex, spacing, text, backgroundColor, radius, shadow } from "maui";

function Row({ children }: { children: React.ReactNode }) {
  const className = useStyles(
    flex({ direction: "row", alignItems: "center", gap: 4 }),
    radius.sm,
    shadow.subtle,
    style({
      minWidth: 0,
      backgroundColor: backgroundColor.element,
    }),
  );
  return <div className={className}>{children}</div>;
}
```

- `text({...})`, `shadow.subtle`, `background.element`, `radius.md`, `flex({...})`, `spacing.padding({...})` are already style objects — pass them to `useStyles`.
- `style({ ... })` is for leftover CSS that tokens do not cover (`minWidth`, grid templates, absolute positioning).
- Compose several objects in one `useStyles` call. Falsy entries are skipped.
- For one-off layout, prefer `Flex` (see [layout-utilities.md](components/layout-utilities.md)). For repeated custom chrome, prefer tokens + `useStyles`.

## Color

`colors` is Radix Scales with a brand `accent` (teal in light, violet in dark). Each scale has steps **1–12**. Alpha scales are `colors.grayAlpha`, `colors.accentAlpha`, `colors.blueAlpha`, …

| Steps | Use                             |
| ----- | ------------------------------- |
| 1–2   | App / subtle surfaces           |
| 3–5   | Interactive washes              |
| 6–8   | Borders / strong lines          |
| 9–10  | Solid fills (9 rest, 10 hover)  |
| 11–12 | Text (11 secondary, 12 primary) |

```ts
import { colors, colorNames, paletteNames } from "maui";

colors.accent[9]; // solid brand fill
colors.gray[12]; // high-contrast text
colors.blueAlpha[8];
```

`colorNames` is `"accent"` plus every Radix palette name. `paletteNames` omits `"accent"`. `"blue"` as a `variantColor` is the Radix blue scale, not CSS `blue`.

Prefer semantic surfaces over raw scale steps for chrome:

```ts
import { background, backgroundColor } from "maui";

backgroundColor.app; // page
backgroundColor.element; // raised control / card
backgroundColor.elementHover; // 3.5% gray-12 wash over element
backgroundColor.elementActive; // 7% wash
background.app; // style objects of the same values
background.element;
background.accent; // accent[9]
```

Hover/active washes use `color-mix` in oklch (`surfaceWash`, transparent by default). **Do not transition `background` / `background-color` on hover.** Quiet `Button` uses `surfaceMixPercent` (6% light / 9% dark, press 2×) with Alpha[9]. Raised `elementHover` is still 3.5% gray-12 over the element surface.

## Text

```ts
import { text, monospace, fontFamily, monoFontFamily } from "maui";

text({
  size: "sm", // 2xs | xs | sm | md | lg | xl  (default md)
  fontWeight: 500, // 400 | 500 | 600 | 700          (default 400)
  color: "lowContrast", // lowContrast | highContrast | accent | onAccent
  monospace: true,
  tabular: true, // font-variant-numeric: tabular-nums
});
```

| Size  | Font | Line |
| ----- | ---- | ---- |
| `2xs` | 10px | 14px |
| `xs`  | 12px | 18px |
| `sm`  | 13px | 20px |
| `md`  | 14px | 22px |
| `lg`  | 16px | 24px |
| `xl`  | 22px | 30px |

Sizes step up on the **Large platform scale** (`:root[data-scale="large"]`, driven by `(pointer: coarse)` under the system preference): `md` is 14px/22px on desktop and 17px/26px on coarse pointers. See `useScale` / `ScaleProvider`.

- `lowContrast` → `gray[11]`, `highContrast` → `gray[12]`, `accent` → `accent[11]`, `onAccent` → white.
- UI sans: `fontFamily` (system ui-sans-serif stack). Mono: Commit Mono with `ss05` smart kerning (`monoFontStyle` / `monospace`).
- `tabular: true` → `font-variant-numeric: tabular-nums`. NumberField, TableHead, and TableCell turn this on by default. Body copy and Prose stay off.
- `baseTextStyle` is md / 400 / highContrast — already on `html, body`.
- Inside `Prose`, `H1`–`H4` / `P` / lists switch to the **prose** scale (`sm` 14px, `md` 16px, `lg` 18px), which is larger and has reading rhythm. Prose block sizes and line heights also step up ~1.2x on the Large platform scale. Do not put app chrome inside `Prose`.

`proseContainerStyle` is the composable column (`maxWidth: proseMaxWidth`, `"80ch"`). `sizing.contentWidth` is that same style. `sizing.fullWidth` is `width: 100%`.

## Spacing

Scale steps are **not pixels**:

| Step | px  |
| ---- | --- |
| 1    | 2   |
| 2    | 4   |
| 3    | 6   |
| 4    | 9   |
| 6    | 12  |
| 8    | 16  |
| 12   | 24  |
| 16   | 32  |

```ts
spacing.padding({ all: 4, x: 6, y: 2, top: 8 });
spacing.gap[4]; // style { gap: 9px }
spacing.value(4); // "9px" — only when gap/padding tokens cannot apply
```

`Flex` / `Gap` / `flex({ gap })` all take these steps. Put inset on `Flex` with `padding` / `p` / `px` / `py` / `pt` / `pr` / `pb` / `pl`.

## Layout tokens

```ts
flex({ direction: "row" | "column", alignItems, justifyContent, gap, wrap });
flexItem({ size: "hug" | "fill" | "auto", alignSelf, order });
grid({
  columns: "one" | "two" | "three" | "autoFit" | "sidebarContent",
  alignItems,
  justifyContent,
  gap,
});
gridItem({
  area: "sidebar" | "content",
  span: "full" | 1 | 2 | 3,
  alignSelf,
  justifySelf,
});
```

- `alignItems` / `alignSelf`: `start` | `center` | `end` | `stretch` | `baseline`
- `justifyContent`: `start` | `center` | `end` | `between` | `around` | `evenly`
- `justifySelf` (grid items): `start` | `center` | `end` | `stretch` | `baseline`
- `gap` on these token helpers also accepts `0`.
- `sidebarContent` is `180px minmax(0, 1fr)` with areas `"sidebar content"`.

Prefer `<Flex row gap={4}>` for one-off JSX. Use `flex()` / `grid()` when composing with other tokens.

## Radius

`radius.none` | `2xs` (2px) | `xs` (3) | `sm` (4) | `md` (6) | `lg` (8) | `xl` (12) | `pill` | `circle`.

Controls typically use `sm`. Cards / sidebars use `lg`. Avatars use `circle`.

## Shadows and rings

```ts
shadow.control                                  // button/form-control style object
shadow.subtle | shadow.medium | shadow.strong   // elevation style objects
shadowVars.control | .subtle | .medium | .strong // raw box-shadow strings
tintedSubtle(color)                             // subtle ring+blur tinted from a fill
```

`shadow.control` uses inset highlights and a compact outer edge. Every elevation
already includes a 1px ring. **Do not also `border()` the same element.**

`border(sides, color)`:

- `sides`: `[]` for all sides, or `"top" | "right" | "bottom" | "left"`
- `color`: `"border"` (gray-12 @ 5%) | `"outline"` (10%) | `"accent"` (`accent[8]`)

`borderColor.border` / `borderColor.outline` are the raw color strings (hairlines, `borderBottom`).

`focusRing(selector = "&:focus-visible", existingShadow?)` — Radix blue ring. Pass `shadowVars.control` as the second argument so a form control keeps its surface treatment while focused; use the matching elevation variable for other raised surfaces.

`visuallyHidden` — clip an input and keep the styled sibling visible (Checkbox / Switch / Radio).

## Motion

```ts
motionDurationMs; // 80
motionStreamDurationMs; // 80 — Streamdown word fade
motionEasing; // "ease-in-out"
motion.standard("opacity", "transform"); // 80ms ease-in-out on those properties
overlayMotion; // shared tooltip, dialog, backdrop, and reduced timings
```

Use `motion.standard` for opacity, transform, box-shadow, color. **Never** for hover `background` / `background-color`.

`overlayMotion` defines tooltip enter (120ms entrance curve), tooltip exit
(80ms ease-in), dialog enter (200ms entrance curve), dialog exit (120ms
ease-in), backdrop (100ms), and opacity-only reduced motion (80ms). Crossfade
enter is a 0.3s spring (`bounce` 0.2); exit uses `motionDurationMs` /
ease-in-out. Streaming markdown uses `motionStreamDurationMs`.

## Sizing and icons

`iconSizeValues` pairs t-shirt sizes to icon boxes (slightly above the matching font-size):

| Size  | Box                  |
| ----- | -------------------- |
| `2xs` | 12px                 |
| `xs`  | 14px                 |
| `sm`  | 16px (default)       |
| `md`  | 18px                 |
| `lg`  | 20px                 |
| `xl`  | 24px (intrinsic SVG) |

Stroke/fill is `currentColor`. Pass `size` on the icon component; optional `width` / `height` override the box.

## Avatar tokens

`avatar.green` / `avatar.orange` / `avatar.pink` each have `background` and `foreground`. The `Avatar` component also uses `accent[4]`/`[11]`. You rarely need these tokens directly.

## Prose tokens

For HTML that is **not** React typography (`Editor` ProseMirror tree, Streamdown output):

- `prose(size)` — style objects for paragraph, h1–h4, link, blockquote, list (`size`: `sm` | `md` | `lg`)
- `proseRhythm(size)` — margin-top-only rhythm for `Prose` children
- `proseHtml(size)` — flex-column + gap styles for a markdown HTML tree
- `proseStreamingMarkers` — fade list markers with Streamdown’s word animation

Prefer `<Prose>` + `H1`/`P`/… for React trees. Use `proseHtml` only when rendering markdown HTML.
