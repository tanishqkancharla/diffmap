# Tab bar

Gallery: `/components/tab-bar`. Import from `"maui"`.

`TabBar` is a controlled, horizontally scrollable workspace tab toolbar. The selected tab uses Maui’s default outlined `Button` treatment. Unselected tabs are quiet and separated by hairlines. Optional icons, closing, and adding are built in.

```tsx
const [selectedId, setSelectedId] = useState("changes")

<TabBar
  aria-label="Workspace tabs"
  items={[
    { id: "changes", label: "Changes", icon: <FileText /> },
    { id: "pull-request", label: "PR #34", icon: <GitPullRequest />, isClosable: true },
  ]}
  selectedId={selectedId}
  onSelectionChange={setSelectedId}
  onClose={(id) => closeTab(id)}
  onAdd={() => addTab()}
  addLabel="New session"
/>
```

| Prop                | Notes                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `items`             | `{ id, label, icon?, isClosable? }[]`                                                                                                     |
| `selectedId`        | Controlled selected item ID                                                                                                               |
| `onSelectionChange` | Called when a tab is pressed or selected with the keyboard                                                                                |
| `onClose`           | Enables a close control for every item where `isClosable` is true. Selected tabs show it persistently; unselected tabs reveal it on hover |
| `onAdd`             | Shows an icon-only add button                                                                                                             |
| `addLabel`          | Accessible add-button label; defaults to `"New tab"`                                                                                      |
| `aria-label`        | Required accessible label for the tab toolbar                                                                                             |

Left/Right arrows wrap through tabs (and respect RTL). Home/End select the first/last tab. Delete or Backspace calls `onClose` for a selected closable tab.

## Styles

**TabBar** — `tabBarStyles`. `list` and `tab` need TabBar's exact tab markup.

- `root` — outer `<div>`.
- `list` — `role="toolbar"` row; hides a `> span` separator beside a `> div` tab whose button is RAC `data-hovered` or `aria-pressed="true"`.
- `tab` — each tab's `<div>` with `data-selected="true"`; reveals the `[data-close-control]` sibling on hover.
- `button({ isSelected })` — the tab's RAC `Button`.
- `label` — the tab's text `<span>`.
- `close` — the `size="sm" variant="quiet"` close `Button`.
- `separator` — the `<span>` between tabs.
- `add` — the trailing add `Button`.
