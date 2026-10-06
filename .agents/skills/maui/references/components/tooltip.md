# Tooltip

Gallery: `/components/tooltip`. Import from `"maui"`.

Wraps the trigger in an inline-block `<span>`. Child should contain something focusable.

```tsx
<Tooltip content="Previous" placement="top" delay={400}>
  <Button variant="quiet" aria-label="Previous">
    <ChevronLeft size="sm" />
  </Button>
</Tooltip>
```

`placement`: `top` | `bottom` | `left` | `right`. The default hover delay is
400ms; keyboard focus remains immediate. The solid surface uses an outline with
no shadow. First appearance uses opacity plus 2px travel toward the trigger;
final disappearance is an 80ms fade. Adjacent tooltips switch instantly.
