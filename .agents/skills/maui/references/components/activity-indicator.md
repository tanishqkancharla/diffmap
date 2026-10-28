# Activity indicator

Gallery: `/components/activity-indicator`. Import from `"maui"`.

iOS-style spinner: eight spokes with a fading tail that rotate in 45° steps. `size` is a CSS length (default `1em`). `variant`: `"accent"` (default) | `"primary"` (currentColor) | `"muted"`. `aria-label` defaults to `"Loading"`.

On an accent fill, such as a primary button, pass `variant="primary"` so the spinner takes the button text color.

Use it for loading: fetching, saving, syncing, and other indeterminate waits. When waiting on LLM inference, use [Thinking](thinking.md) instead. The `Spinner` icon is a static glyph, not this component.

```tsx
<Button variant="primary">
  <ActivityIndicator variant="primary" aria-label="Saving" />
  Saving
</Button>
```
