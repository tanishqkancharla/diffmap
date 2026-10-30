# Form controls

Gallery: `/components/form-controls`. Import from `"maui"`. [Select](select.md) has its own page.

All fields are 28px tall by default, full width of the parent, `shadow.control` except `QuietTextField`. They take React Aria field props (`value`, `onChange`, `placeholder`, `isDisabled`, `isInvalid`, `aria-label`, `id`, …).

```tsx
<TextField aria-label="Title" placeholder="Title" value={v} onChange={setV} keyboardHint="T" />
<SearchField aria-label="Search" value={q} onChange={setQ} keyboardHint="/" />   // clear button when non-empty
<NumberField aria-label="Count" value={n} onChange={setN} minValue={0} maxValue={10} />
<QuietTextField aria-label="Filter" placeholder="Filter" value={f} onChange={setF} />
```

`NumberField` uses tabular numerals so the value does not shift as you step. Invalid (unfocused) adds a red 1px ring on top of `shadow.control`. Placeholders are italic `gray[8]`. Cap width in the parent (`maxWidth: 240px` is the gallery default).

`TextField` also accepts:

- `size="sm"` — 24px tall with tighter padding, matching `Button size="sm"`, for dense rows such as tree items.
- `ref` — the underlying `<input>`, for focus, blur, or selection.
- `errorMessage` — shown below the field while `isInvalid` is true and linked to the input with `aria-describedby`.

```tsx
<TextField
  aria-label="Name"
  size="sm"
  value={name}
  onChange={setName}
  isInvalid={invalid}
  errorMessage="Use a name without slashes."
/>
```

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

## Styles

**TextField** — `textFieldStyles`

- `root` — field wrapper around the input and error.
- `input({ size, keyboardHint })` — RAC `Input`; `:hover`, `:disabled`, `aria-invalid`, `:focus-visible`, `::placeholder`.
- `frame` — relative wrapper around the input when a keyboard hint is shown.
- `keyboardHint` — Maui `Kbd variant="quiet"` inside `frame`.
- `error` — RAC `FieldError`.

**SearchField** — `searchFieldStyles`

- `root` — wrapper around the input and clear button; styles its descendant `input` and `button`, so it needs that markup.
- `input` — RAC `Input`; same states as `textFieldStyles.input`.
- `keyboardHint` — Maui `Kbd variant="quiet"` inside `root`.

**NumberField** — `numberFieldStyles`

- `root` — RAC `Group`; `:has(:focus-visible)`, `:has(input:disabled)`, `:has(input[aria-invalid='true'])`; styles the stepper `button`s inside a `.number-stepper` wrapper, so it needs that markup.
- `input` — RAC `Input`; `:hover`, `:disabled`, `::placeholder`.

**QuietTextField** — `quietTextFieldStyles`

- `input({ keyboardHint })` — RAC `Input`; `:hover`, `:disabled`, `aria-invalid`, `:focus-visible`, `::placeholder`.
- `frame` — relative wrapper around the input when a keyboard hint is shown.
- `keyboardHint` — Maui `Kbd variant="quiet"` inside `frame`.

**Checkbox** — `checkboxStyles`

- `root` — RAC `Checkbox`; `[data-hovered]`, `[data-selected]`, `[data-focus-visible]` restyle `box` and `check` by their own classes.
- `box` — box `span` inside the checkbox.
- `check` — checkmark `svg` inside `box`.
- `label` — label text `span`.

**Switch** — `switchStyles`

- `root` — RAC `Switch`; `[data-hovered]`, `[data-selected]`, `[data-focus-visible]` restyle `track` and `thumb` by their own classes.
- `track` — track `span` inside the switch.
- `thumb` — knob `span` inside `track`.
- `label` — label text `span`.

**Radio** — `radioStyles`

- `group` — RAC `RadioGroup`.
- `groupLabel` — RAC `Label` inside the group.
- `root` — RAC `Radio`; `[data-hovered]`, `[data-selected]`, `[data-focus-visible]` restyle `circle` and `dot` by their own classes.
- `circle` — circle `span` inside the radio.
- `dot` — dot `span` inside `circle`.

**Slider** — `sliderStyles`

- `root` — RAC `Slider`.
- `header` — `div` holding the label and output.
- `label` — RAC `Label` and RAC `SliderOutput`.
- `track` — RAC `SliderTrack`; draws the rail in `::before`.
- `fill` — `div` inside the track; set inline `width` from `state.getThumbPercent(0)`.
- `thumb` — RAC `SliderThumb`; `[data-focus-visible]`, `[data-dragging]`.
