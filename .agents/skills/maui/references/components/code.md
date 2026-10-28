# Code

Gallery: `/components/code`. Import from `"maui"`.

```tsx
<Code>proseMaxWidth</Code>
<Kbd>⌘</Kbd><Kbd>K</Kbd>
<CodeBlock lang="ts">{`const n = 1`}</CodeBlock>
```

`CodeBlock` highlights with Shiki using the resolved theme. `lang` is required. Unsupported langs / pending highlight render a plain `<pre>`.

## Styles

**Code** — `codeStyles`

- `root` — any inline `<code>` element.

**Kbd** — `kbdStyles`

- `root({ variant })` — any `<kbd>` element; `variant` is `"default"` | `"quiet"`.

**CodeBlock** — `codeBlockStyles`

- `root` — the `<pre>`, or a wrapper around Shiki HTML (restyles `.shiki` descendants).
- `code` — the `<code>` inside a plain `<pre>`.
