# Select

Gallery: `/components/select`. Import from `"maui"`. Related: [list-box.md](list-box.md), [menu.md](menu.md).

Trigger + `CollectionPopover` + `ListBox`. Width 100% of parent.

```tsx
<Select
  label="Favorite fruit"
  placeholder="Choose a fruit"
  selectedKey={key}
  onSelectionChange={(k) => setKey(String(k))}
>
  <SelectItem id="apple">Apple</SelectItem>
  <SelectItem id="banana">Banana</SelectItem>
</Select>
```

React Aria also accepts `value` / `onChange` on some versions; `selectedKey` / `onSelectionChange` is the usual collection API. Optional `description`, `errorMessage`, `items` + child render function.

Selected items show an accent checkmark on the right (`ListBoxItem`).

`CollectionPopover` is the shared RAC `Popover` for Select and Menu. Default `placement="bottom start"`, `offset={6}`, min-width = trigger width, max-height 280px, `shadow.strong`. Use it for a custom collection overlay.

## Styles

**Select** — `selectStyles`

- `root` — RAC `Select`.
- `label` — RAC `Label` (`labelText`).
- `trigger` — RAC `Button`; `data-pressed`, `aria-expanded`, `data-disabled`, `data-invalid`, `:focus-visible`.
- `value` — RAC `SelectValue`; `data-placeholder`.
- `chevron` — icon inside the trigger; rotates under the `[data-open]` Select root.
- `description` — RAC `Text slot="description"`.
- `error` — RAC `FieldError`.

**CollectionPopover** — `collectionPopoverStyles`

- `root` — RAC `Popover`; min-width from RAC `--trigger-width`. Placement/offset are props, not styles.
