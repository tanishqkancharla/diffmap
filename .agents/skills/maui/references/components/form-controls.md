# Form controls

Gallery: `/components/form-controls`. Import from `"maui"`. [Select](select.md) has its own page.

All fields are 28px tall, full width of the parent, `shadow.control` except `QuietTextField`. They take React Aria field props (`value`, `onChange`, `placeholder`, `isDisabled`, `isInvalid`, `aria-label`, `id`, …).

```tsx
<TextField aria-label="Title" placeholder="Title" value={v} onChange={setV} keyboardHint="T" />
<SearchField aria-label="Search" value={q} onChange={setQ} keyboardHint="/" />   // clear button when non-empty
<NumberField aria-label="Count" value={n} onChange={setN} minValue={0} maxValue={10} />
<QuietTextField aria-label="Filter" placeholder="Filter" value={f} onChange={setF} />
```

`NumberField` uses tabular numerals so the value does not shift as you step. Invalid (unfocused) adds a red 1px ring on top of `shadow.control`. Placeholders are italic `gray[8]`. Cap width in the parent (`maxWidth: 240px` is the gallery default).

`TextField`, `SearchField`, and `QuietTextField` accept `keyboardHint`, a single-character shortcut rendered at the inline end while the field is unfocused. The hint is presentational; the consuming app owns the keyboard handler. `SearchField` hides it when the query is non-empty so the clear button can use the same space.

## `Checkbox`

Controlled only: `checked` + `setChecked`. Optional `label`.

```tsx
<Checkbox label="Subscribe" checked={on} setChecked={setOn} />
```

## `Switch`

Controlled: `selected` + `onChange`. **`label` is required.**

```tsx
<Switch label="Enable notifications" selected={on} onChange={setOn} />
```

## `Slider`

`label` required. React Aria slider props: `value`, `onChange`, `minValue`, `maxValue`, `step`. Default width 240px. Shows the formatted value as `<output>`.

```tsx
<Slider label="Volume" value={v} onChange={setV} minValue={0} maxValue={100} />
```

## `RadioOptionGroup` / `RadioOption`

```tsx
<RadioOptionGroup label="Plan" value={plan} onChange={setPlan}>
  <RadioOption value="free">Free</RadioOption>
  <RadioOption value="pro">Pro</RadioOption>
</RadioOptionGroup>
```

`RadioOption` must be nested. Group also accepts React Aria radio-group props (`isDisabled`, …).
