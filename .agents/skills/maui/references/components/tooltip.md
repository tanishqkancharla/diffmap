# Tooltip

Gallery: `/components/tooltip`. Import from `"maui"`.

Wraps the trigger in an inline-block `<span>`. Child should contain something focusable.

```tsx
<Tooltip content="Previous" placement="top" delay={500}>
  <Button variant="quiet" aria-label="Previous">
    <ChevronLeft size="sm" />
  </Button>
</Tooltip>
```

`placement`: `top` | `bottom` | `left` | `right`. Adjacent tooltips skip enter animation (warm group); only the first/last animate.
