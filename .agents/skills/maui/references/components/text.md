# Text

Gallery: `/components/text`. Import from `"maui"`. Type tokens: [tokens.md](../tokens.md). Headings and `Prose`: [prose.md](prose.md).

Inline `<span>`. Defaults: `size="md"`, `fontWeight={400}`, `color="highContrast"`.

```tsx
<Text size="sm" color="lowContrast">Secondary</Text>
<Text size="lg" fontWeight={600} monospace>src/maui.ts</Text>
<Text tabular>1,280</Text>
```

Also accepts native span props except `color` (that axis is the token).

`size`: `2xs` | `xs` | `sm` | `md` | `lg` | `xl`. `fontWeight`: `400` | `500` | `600` | `700`. `color`: `lowContrast` | `highContrast` | `accent` | `onAccent`. `tabular`: boolean (`font-variant-numeric: tabular-nums`).
