# Banner

Gallery: `/components/banner`. Import `Banner` from `"maui"`.

Persistent in-flow message. Use `layout="inline"` (default) for one sentence,
even when it wraps. Always use `layout="stacked"` for multiple sentences or a
title with supporting text. Choose layout explicitly; Banner does not parse copy.

```tsx
<Banner
	tone="info"
	actions={<Button variant="quiet" variantColor="blue" onPress={reload}>Reload</Button>}
>
	A new version is available.
</Banner>

<Banner
	tone="warning"
	layout="stacked"
	title="Your connection was interrupted."
	actions={<Button variant="quiet" variantColor="amber" onPress={reconnect}>Reconnect</Button>}
>
	Changes are saved on this device. Reconnect to sync.
</Banner>
```

- `tone`: `neutral` (default), `info`, `success`, `warning`, `danger`.
- Compose `actions` with quiet buttons in the matching palette: gray, blue, green,
  amber, red respectively. Banner does not restyle supplied actions. Stacked and
  wrapped actions align right.
- `title` and children accept React nodes. `icon` defaults to the tone's icon;
  supply a decorative SVG or `false` to hide it. Icons match the first line height.
  Icon-to-text gap and outer padding share spacing step 3 (6px; 8px at large scale).
- `onDismiss` adds a close button; caller owns visibility. `dismissLabel` defaults
  to `"Dismiss notification"`. No timer or automatic dismissal.
- No automatic announcements. Set `role="status"` for live updates or
  `role="alert"` for urgent failures; tone does not determine urgency.

## Styles

**Banner** — `bannerStyles`: `root({ tone })`, `icon`, `body({ layout })`, `content`,
`title`, `description`, `actions`, `dismiss`. Plain div parts; icon is decorative.
