# Calendar

Gallery: `/apps/calendar`. Not on the `"maui"` barrel. Prefer this layout; rebuild with barrel components. Package source: `"maui/src/apps/Calendar/"` if you need a detail this file does not cover.

**Three panes** (sidebar can collapse):

```
[ 196px sidebar ] [ flexible week grid ] [ ~200–220px details ]
```

Shell: `radius.lg`, `shadow.subtle`, `minHeight` ~640px, `backgroundColor.app`, `overflow: hidden`. Without sidebar: `minmax(0, 1fr) minmax(200px, 220px)`.

This is a **full-bleed schedule**, not a prose column.

## Sidebar

Raised `background.element` + `shadow.subtle`, `Flex column` with `gap={6} p={4}`.

- Toolbar: quiet icon buttons — hide sidebar (`Sidebar` icon), new event (`Plus`). Wrap in `Tooltip`.
- **Mini month**: 7-column weekday initials (`2xs`), 24px circular day buttons. Today = `accent[9]` + `onAccent` text. Selected (not today) = `grayAlpha[4]`. Outside-month = `gray[8]`. Hover = `elementHover` (no background transition on the chrome; day buttons may use `motion.standard` on color only). Prev/next month chevrons.
- `TextField` placeholder “Meet with...”.
- Account groups: xs/500/lowContrast email, then source rows (10px color swatch + name + hover-revealed quiet `Eye` to hide the calendar). Hidden sources drop to 45% opacity.
- Footer: quiet “Add calendar account” / “Add Notion database”.

Event colors: `accent` | `green` | `orange` | `pink` — fill step 3, text 11, selected fill 9 + `onAccent`.

## Week grid

- Header: month title (`xl`/700) + `Avatar` + `Select` for 1/3/5/7-day view + `Today` + prev/next quiet chevrons (`Tooltip`).
- Sticky **all-day** row, then a vertically scrolling 24h grid (`HOUR_HEIGHT` 52px).
- Timed events: absolutely positioned blocks (`radius.sm`, padding 3/1, title + time range `2xs` lowContrast). Click a block to select; click empty grid to **create** a 30-minute event (snap 15 minutes).
- Today column: `accentAlpha[2]` wash. Now line: 2px `accent[9]` + circle on the today column.
- Time gutter ~36px, `2xs` mono labels.

## Details pane

Raised `Flex column` with `p={8}`.

- `SearchField` “Search events”. Matches render as a list of title (`FuzzyString`) + meta; click jumps to that event and date.
- Selected event: title `lg`/600, time range or “All day”, duration, calendar swatch + name, `Button` “Add meeting note”.
- None selected: “Select an event to see details, or click the grid to create one.”
- Footer: “Useful shortcuts” with `Kbd` (`T` today, `←`/`→` range, `` ` `` sidebar). Ignore shortcuts when focus is in an input.

Hotkeys (no modifiers): `t` today, arrows shift the visible range by `viewDays`, backtick toggles sidebar.

Empty search: show nothing extra (the selected-event block and shortcuts remain). Empty calendar: still show the grid + the details empty copy.
