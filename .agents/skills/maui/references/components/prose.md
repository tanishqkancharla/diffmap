# Prose

Gallery: `/components/prose`. Import from `"maui"`. Type tokens: [tokens.md](../tokens.md).

Typography components have **no margin and no max-width**. Spacing belongs to the parent (`Flex` gap or `Prose`).

## `Prose`

Long-form column: compose `proseContainerStyle` (`maxWidth: 80ch`) plus vertical rhythm. `size?: "sm" | "md" | "lg"` (default `md`) is inherited via `useProseSize()`.

```tsx
<Prose size="md">
  <H2>Shipping notes</H2>
  <P>
    Body copy with <Link href="/docs">a link</Link>.
  </P>
  <Ul>
    <Li>First</Li>
    <Li>Second</Li>
  </Ul>
</Prose>
```

Do not wrap app chrome (sidebars, toolbars, forms) in `Prose`.

## `H1` `H2` `H3` `H4` `Blockquote` `Link`

**Children must be a `string`.** `Link` also needs `href`.

Outside `Prose` they use the app `text` scale (`H1` xl/700, `H2` lg/600, `H3`/`H4` md/600). Inside `Prose` they switch to the prose scale.

## `P` `Ul` `Ol` `Li` `Label`

`P` / lists / `Li` take `ReactNode`. `Label` forwards `<label>` attributes (`htmlFor`, …) and uses xs/500/lowContrast, non-selectable (`labelText`).

```tsx
<Flex column gap={3}>
  <Label htmlFor="name">Name</Label>
  <TextField id="name" aria-label="Name" />
</Flex>
```
