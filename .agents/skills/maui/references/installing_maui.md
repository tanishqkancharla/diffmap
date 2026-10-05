# Installing and updating Maui

Maui is a TypeScript-first design system styled with `purse-styles`. Wrap the app in `MauiProvider`, then import tokens and components from `"maui"`.

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
- `"maui/icons"` — tree-shakeable named icon modules using the same names as `Icons.*`
- `"maui/editor"` — `Editor` and `EditorProps`; styled, caller-owned TipTap surface
- `"maui/markdown-editor"` — `MarkdownEditor` and `MarkdownEditorProps`; Markdown convenience wrapper
- `"maui/src"` — TypeScript source barrel
- `"maui/src/*"` — TypeScript source for deep imports
- `"maui/skills/maui"` — the Maui skill entrypoint
- `"maui/skills/maui/*"` — reference files next to the skill

`MauiProvider` sets up the theme (`data-theme` and `color-scheme`), `PurseProvider`, design-system globals, and the focus UI database used by Button and Dialog.

The editors are not exported from the root barrel. TipTap is an optional peer
dependency: install it only when using an editor. Follow the exact install
commands and migration notes in [Editor](components/editor.md). Package paths
shown as `maui` assume that alias; the npm package is `@tanishqkancharla/maui`.

## Theme initialization

Put the exported `themeFoucScript` string in a classic inline `<script>` in `<head>` before React starts so `data-theme` is correct on first paint. The gallery `src/index.html` uses the same script.

Use `useTheme()` for the preference and resolved theme. Token dark values use the `DARK_THEME` selector (`:root[data-theme="dark"]`). Prefer semantic tokens such as `colors`, `background`, `avatar`, and `focusRing()` over bespoke CSS variables.

Maui is open source under the MIT License.
