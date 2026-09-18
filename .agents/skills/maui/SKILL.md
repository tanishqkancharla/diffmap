---
name: maui
description: Conventions and design constraints for consuming the Maui design system. Use when building UI with Maui tokens, components, patterns, or purse-styles. Prefer this skill and its references for composition knowledge.
---

# Maui

TypeScript-first design system styled with `purse-styles`. Wrap the app in `MauiProvider`, then import tokens and components from `"maui"`.

```ts
import { style } from "purse-styles"
import {
	MauiProvider,
	background,
	border,
	colors,
	radius,
	shadow,
} from "maui"

function App() {
	return (
		<MauiProvider>
			{/* … */}
		</MauiProvider>
	)
}
```

The published package exposes:

- `"maui"` — compiled barrel (`dist/`) of provider, theme, tokens, and components
- `"maui/icons"` — tree-shakeable named icon modules (same names as `Icons.*`)
- `"maui/src"` — TypeScript source barrel
- `"maui/src/*"` — TypeScript source for deep imports
- `"maui/skills/maui"` — this skill file
- `"maui/skills/maui/*"` — reference files next to this skill

`MauiProvider` sets up theme (`data-theme` / `color-scheme`), `PurseProvider`, design-system globals, and the focus UI database used by Button/Dialog.

## How to learn Maui

Prefer this skill for composition knowledge — how to assemble tokens, components, patterns, and apps. Reach for package source (`"maui/src/patterns"`, `"maui/src/apps"`, or an install under `node_modules`) when you need a detail the skill does not cover.

Before designing or implementing new UI:

1. Read the constraints in this file.
2. Open the matching reference (same grouping as the [gallery nav](https://maui.tanishqkancharla.dev)) and reuse its structure, tokens, and interactions.

| Need                                          | Read                                         |
| --------------------------------------------- | -------------------------------------------- |
| Tokens, `purse-styles`, motion, layout, theme | [references/tokens.md](references/tokens.md) |
| A component                                   | [Components](#components)                    |
| A pattern                                     | [Patterns](#patterns)                        |
| An app                                        | [Apps](#apps)                                |

Patterns, demo apps, and the gallery `Panel` preview frame are **not** package components. `Panel` is not on the `"maui"` barrel, not in `src/components`, and not in the JSX editor catalog. Prefer the recipes in those references and rebuild with barrel exports (`Button`, `Flex`, `text(...)`, …).

## Design constraints

- Hover backgrounds have no transitions. Hover fills (`backgroundColor.elementHover`, quiet-button washes, list/row highlights) snap instantly. Do not animate `background` / `background-color` on hover with `motion.standard(...)` or a CSS `transition`. Other motion (tooltips, transforms) is fine.
- Simple apps default to a `proseMaxWidth` column (`72ch`) centered in their container: `width: "100%"`, `maxWidth: proseMaxWidth`, `marginInline: "auto"`. `sizing.contentWidth` is the same measure. Use this for single-column tools, settings, forms, and reading layouts. Multi-pane or full-bleed apps (inbox, calendar, IDE) are the exception.
- Always design empty states. Every list, inbox, search result, or collection needs an intentional empty composition (copy and an optional action), never a blank panel.

## Theme FOUC

Put the exported `themeFoucScript` string in a classic inline `<script>` in `<head>` (before React boots) so `data-theme` is correct on first paint. The gallery `src/index.html` uses the same script.

Use `useTheme()` for preference / resolved theme. Token dark values use the `DARK_THEME` selector (`:root[data-theme="dark"]`). Prefer semantic tokens (`colors`, `background`, `avatar`, `focusRing()`) over bespoke CSS variables.

## Shadows

Use the three-level elevation scale:

- `shadow.subtle` — controls, cards, and ordinary raised surfaces
- `shadow.medium` — tooltips and larger floating panels
- `shadow.strong` — dropdowns, popovers, and dominant overlays

All three already include a 1px ring. Do not also apply `border()`, `borderColor.outline`, or another ring on the same element.

Buttons and form-control surfaces use `shadow.subtle` by default. For compound
controls, apply it once to the outer control boundary rather than to every
internal button or segment.

## Focus

`focusRing()` applies a theme-aware Radix blue shadow (`blueAlpha[8]` hard edge + `blueAlpha[5]` glow). Do not hand-roll a competing outline or box-shadow for keyboard focus.

## Layout utilities

`Flex` and `Gap` take spacing scale steps (`1 | 2 | 3 | 4 | 6 | 8 | 12 | 16`), not raw pixels. Example: `<Flex row gap={4} padding={4}>` is 9px gap and 9px inset, not 4px. Put padding on `Flex` (`padding` / `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl`) — there is no `Padding` component. `alignItems` and `justifyContent` use the same tokens as `flex()` (`start` | `center` | `end` | …; `justifyContent` also has `between` | `around` | `evenly`). `background` is a surface token (`app`, `element`, `accent`, …). `Spacer` grows to fill leftover flex space. `Divider` is a horizontal rule.

## Icons

Import named icons so unused SVGs are tree-shaken. Do not import the `Icons` namespace in app code unless you want the full set.

```ts
import { Search, Plus } from "maui"
import { Text as TextIcon } from "maui/icons"

<Search size="sm" />
<TextIcon size="md" />
```

`size` uses the same t-shirt scale as `text(...)` (`2xs`–`xl`, default `sm`). Stroke and fill use `currentColor`. Icons that share a root export name (`Text`, `Badge`, `Switch`, `H1`, `H2`, `H3`, `Link`, `Menu`, `Code`, `Blockquote`, `Padding`, `SearchField`) are `TextIcon` / `BadgeIcon` / … from `"maui"`, or the original name from `"maui/icons"` / `Icons.Text`.

## Components

Gallery order. Props and composition live in the linked file.

| Page             | Reference                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Avatar           | [avatar.md](references/components/avatar.md)                                                 |
| Badge            | [badge.md](references/components/badge.md)                                                   |
| Buttons          | [buttons.md](references/components/buttons.md) (`Button`, `Overlay`, `Dialog`)               |
| Drawer           | [drawer.md](references/components/drawer.md)                                                 |
| Prose            | [prose.md](references/components/prose.md) (`Prose`, `H1`–`H4`, `P`, lists, `Label`, `Link`) |
| Editor           | [editor.md](references/components/editor.md)                                                 |
| Thinking         | [thinking.md](references/components/thinking.md)                                             |
| Crossfade        | [crossfade.md](references/components/crossfade.md)                                           |
| Loading screen   | [loading-screen.md](references/components/loading-screen.md)                                 |
| Text             | [text.md](references/components/text.md)                                                     |
| Form controls    | [form-controls.md](references/components/form-controls.md)                                   |
| Select           | [select.md](references/components/select.md)                                                 |
| List box         | [list-box.md](references/components/list-box.md)                                             |
| Table            | [table.md](references/components/table.md)                                                   |
| Menu             | [menu.md](references/components/menu.md)                                                     |
| Tooltip          | [tooltip.md](references/components/tooltip.md)                                               |
| Layout utilities | [layout-utilities.md](references/components/layout-utilities.md)                             |
| FuzzyString      | [fuzzy-string.md](references/components/fuzzy-string.md)                                     |
| Icons            | [icons.md](references/components/icons.md)                                                   |
| Code             | [code.md](references/components/code.md)                                                     |

## Patterns

Not on the `"maui"` barrel. Prefer the recipes; rebuild with barrel exports in consuming apps. Hover fills snap; empty collections get copy.

| Page              | Role                                                               | Reference                                                        |
| ----------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Inbox             | Mail thread list with unread dot, hover actions, selection         | [inbox.md](references/patterns/inbox.md)                         |
| Message list      | Thread of raised message cards (avatar + Prose body)               | [message-list.md](references/patterns/message-list.md)           |
| Assistant message | Streaming markdown reply (Streamdown + Maui prose + CodeBlock)     | [assistant-message.md](references/patterns/assistant-message.md) |
| Sidebar           | 240px nav: sections, active item, optional icon and trailing badge | [sidebar.md](references/patterns/sidebar.md)                     |

## Apps

Not on the `"maui"` barrel. Prefer these layouts; rebuild with barrel exports.

| Page         | Role                                                       | Reference                                          |
| ------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| Email client | Two-pane inbox + reading pane                              | [email-client.md](references/apps/email-client.md) |
| AI chat      | Mock streaming chat (Editor + AssistantMessage + Thinking) | [ai-chat.md](references/apps/ai-chat.md)           |
| Calendar     | Three-pane schedule (mini month, week grid, event details) | [calendar.md](references/apps/calendar.md)         |

## License

Maui is open source under the MIT License.
