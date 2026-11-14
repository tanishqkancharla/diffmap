# Buttons

Gallery: `/components/buttons`. Import from `"maui"`. Overlay and Dialog live on this page too.

## `Button`

Styled React Aria `Button` (default `type="button"`). Consumes `ButtonContext`, so it works as a `MenuTrigger`, `Select`, `DialogTrigger`, `ComboBox`, or `DatePicker` child. Default height 28px, `shadow.control`, `radius` 4px.

```tsx
<Button>Save</Button>
<Button variant="quiet">Cancel</Button>
<Button variant="quiet" variantColor="accent">Quiet accent</Button>
<Button variant="text">Text action</Button>
<Button variant="primary" variantColor="blue">Create</Button>
<Button variant="primary" variantColor="#6366f1">Indigo</Button>
<Button size="sm">Compact</Button>
<Button isDisabled>Wait</Button>
<Button isPending={isSaving} pendingLabel="Saving…">Save</Button>
<Button aria-label="Search"><Search size="sm" /></Button>
<Button>
  <Plus size="sm" />
  Create
</Button>
```

| Prop           | Notes                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `size`         | `"default"` (28px) \| `"sm"` (24px with 10px text and 14px icons). Large/touch scale keeps both at a 40px target                                                                                       |
| `variant`      | `"default"` (raised element) \| `"quiet"` (transparent, hover wash) \| `"text"` (transparent, color-only hover) \| `"primary"` (solid fill)                                                            |
| `variantColor` | Palette name or opaque `#hex` / `rgb(...)`. Primary defaults to `"accent"`; quiet and text default to gray and tint the label/icon when set                                                            |
| `isDisabled`   | React Aria name. Maps to native `disabled`. **No `disabled` React prop**                                                                                                                               |
| `isPending`    | Shows a current-color indicator beside visible content. Blocks activation and suppresses hover fill while retaining focusability and variant color. Controlled by the caller, not by returned promises |
| `pendingLabel` | Optional visible string replacing children while pending (e.g. `"Saving…"`). Omit to keep children; provide it to replace an icon with progress text                                                   |
| `onClick`      | Still supported. React Aria also exposes `onPress`                                                                                                                                                     |
| `children`     | Text is wrapped for cap-height trim; SVG icons sit beside text. Icon-only needs `aria-label`                                                                                                           |

Use primary for an emphasized action, default for a raised neutral control, quiet for a low-emphasis action, and text for an inline-style action without a hover fill. Let Button manage its palette and state colors rather than rebuilding the fill or shadow. For exact treatment, inspect `src/components/Button.tsx` in the installed package as described in [design conventions](../design_conventions.md).

Prefer plain labels (optionally alongside icons) so Button controls their foreground; see the [composition rule](../design_conventions.md#composition).

The text variant removes horizontal spacing and surface chrome while keeping the control height and focus ring. Use it when an action should align directly with surrounding text; hover changes the foreground, not the fill.

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
- `body` — scrollable `div` inside the dialog. A 6px inset, offset by a negative margin, keeps full-width field rings and focus glows unclipped.
- `actions` — button row `div` inside the dialog.
