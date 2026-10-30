# Buttons

Gallery: `/components/buttons`. Import from `"maui"`. Overlay and Dialog live on this page too.

## `Button`

Styled React Aria `Button` (default `type="button"`). Consumes `ButtonContext`, so it works as a `MenuTrigger`, `Select`, `DialogTrigger`, `ComboBox`, or `DatePicker` child. Default height 28px, `shadow.control`, `radius` 4px.

```tsx
<Button>Save</Button>
<Button variant="quiet">Cancel</Button>
<Button variant="quiet" variantColor="accent">Quiet accent</Button>
<Button variant="primary" variantColor="blue">Create</Button>
<Button variant="primary" variantColor="#6366f1">Indigo</Button>
<Button size="sm">Compact</Button>
<Button isDisabled>Wait</Button>
<Button aria-label="Search"><Search size="sm" /></Button>
<Button>
  <Plus size="sm" />
  Create
</Button>
```

| Prop           | Notes                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`         | `"default"` (28px) \| `"sm"` (24px with 10px text and 14px icons). Large/touch scale keeps both at a 40px target                                  |
| `variant`      | `"default"` (raised element) \| `"quiet"` (no shadow, transparent) \| `"primary"` (solid fill)                                                    |
| `variantColor` | Palette name or opaque `#hex` / `rgb(...)`. Primary default is `"accent"`. Quiet ignores color unless set; when set, tints the label with no fill |
| `isDisabled`   | React Aria name. Maps to native `disabled`. **No `disabled` React prop**                                                                          |
| `onClick`      | Still supported. React Aria also exposes `onPress`                                                                                                |
| `children`     | Text is wrapped for cap-height trim; SVG icons sit beside text. Icon-only needs `aria-label`                                                      |

Primary: fill step 9, light text (`onAccent`, or step 12 on amber/lime/mint/sky/yellow). Custom CSS fill drops alpha; text is white or near-black from lightness. The fill is a diagonal gradient (`to top left`) from the fill shifted by OKLCH `l − 0.027`, `c × 1.05`, `h − 6.8` to the fill itself. In dark mode the shadow has a 0.5px white top highlight at 15% (`shadow.control` uses 9%); light mode has none. The shadow tints a soft lift from the fill, at half strength in dark mode, and adds a 0.5px edge painted beneath the lift: the fill color’s alpha step 6 in light mode (a custom CSS fill uses the fill at 35%); in dark mode a near-black tint of the fill (OKLCH lightness 0.18, half chroma) — no neutral gray. Hover layers a white-to-transparent sheen over the gradient; disabled drops the gradient. Quiet: no fill; `variantColor` tints the label/icon. Hover/press mix `grayAlpha[9]` (or that color’s alpha 9, or the hex) into transparent at 6% light / 9% dark; press is 2×. Hover fills snap.

While a menu or overlay is open, the trigger keeps the active fill via RAC `data-pressed` / `aria-expanded` (same tokens as `:active`: `elementActive`, or primary step 10).

`useButton(props)` is exported for custom focus-tracked buttons; prefer `Button`.

## `Overlay`

Full-viewport portal. `onClickOutside` fires when the backdrop itself is the mousedown target.

```tsx
{
  open && (
    <Overlay onClickOutside={() => setOpen(false)}>
      {/* centered panel */}
    </Overlay>
  );
}
```

## `Dialog`

Accessible React Aria modal with focus containment/restoration, Escape handling,
outside-click dismissal, scroll locking, and reversible scale/fade motion. The
page is covered by a neutral 10% black scrim and the solid surface uses an
outline border with no blur or shadow.

```tsx
<Dialog isOpen={open} onOpenChange={setOpen}>
  <DialogTitle>Delete project?</DialogTitle>
  <DialogBody>
    <P>This cannot be undone.</P>
  </DialogBody>
  <DialogActions>
    <Button slot="close">Cancel</Button>
    <Button variant="primary" variantColor="red">
      Delete
    </Button>
  </DialogActions>
</Dialog>
```

Keep `Dialog` mounted and control it with `isOpen`; conditional mounting prevents
the exit animation. `size` is `"sm" | "md" | "lg"` (`"sm"` default, 440px;
`"md"` is 640px for forms).
`isDismissable` defaults to true. Use `role="alertdialog"` and disable pointer and
keyboard dismissal when a response is required. Actions are composed rather than
passed as callback props so forms, loading states, links, and custom controls work.

Edge-anchored mobile nav is [`Drawer`](drawer.md), not this Dialog and not Overlay.

## Styles

**Button** — `buttonStyles`

- `root({ variant, size, variantColor })` — RAC `Button` or native `<button>`; same defaults as `Button`. Native `:hover`, `:focus-visible`, `:disabled`; icons must be direct `> svg` children.
- `label` — `<span>` around each text run inside the button (cap-height trim).

**Dialog** — `dialogStyles`

- `overlay` — RAC `ModalOverlay`.
- `modal({ size })` — RAC `Modal`; `size` is `"sm"` (default) | `"md"` | `"lg"`.
- `dialog` — RAC `Dialog`.
- `title` — RAC `Heading slot="title"`.
- `body` — scrollable `div` inside the dialog.
- `actions` — button row `div` inside the dialog.
