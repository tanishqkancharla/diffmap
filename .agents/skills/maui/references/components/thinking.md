# Thinking

Gallery: `/components/thinking`. Import from `"maui"`.

3×3 Game of Life, text-sized. `size` is a CSS length (default `1em`). `variant`: `"primary"` (currentColor) | `"accent"` | `"muted"`.

```tsx
<Flex row alignItems="center" gap={4}>
  <Thinking size="0.75em" variant="muted" />
  <Text size="xs" color="lowContrast">
    Thinking
  </Text>
</Flex>
```
