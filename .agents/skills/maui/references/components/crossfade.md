# Crossfade

Gallery: `/components/crossfade`. Import from `"maui"`.

When `contentKey` changes, the previous view fades out and the next fades in. Views overlap (`AnimatePresence` `mode="sync"`). The root clips overflow.

Omit `direction` (the default) for an in-place opacity fade — same position, no slide. Pass `"up" | "down" | "left" | "right"` to keep the directional crossfade: the outgoing view exits in `direction` while the next enters from the opposite side. Offset is spacing step 6.

```tsx
<Crossfade contentKey={slide.id}>
  <Text size="lg">{slide.title}</Text>
</Crossfade>

<Crossfade direction="left" contentKey={slide.id}>
  <Text size="lg">{slide.title}</Text>
</Crossfade>
```

- `direction` is optional. Default is in-place opacity. Gallery playground starts on none.
- `contentKey` is required. **Do not** put `key` on `Crossfade` itself or the exit is skipped.
- Timing is internal: enter is a spring (`visualDuration` 0.3, `bounce` 0.2); exit uses `motionDurationMs` (80ms) and ease-in-out. There are no public motion props.
- Reduced motion: opacity only (same as the default, even when `direction` is set).
