# Drawer

Gallery: `/components/drawer`. Import from `"maui"`. Sibling of Overlay / Dialog — not a Sidebar prop and not a `SidebarProvider`.

RAC modal overlay that slides in from a logical edge. Internals are RAC `ModalOverlay` + `Modal` + `Dialog` with Motion for drag-to-dismiss and interruptible enter/exit. Do not build this on today’s click-only `Overlay` / `Dialog`.

```tsx
const [open, setOpen] = useState(false)

<Button variant="quiet" aria-label="Open navigation" onPress={() => setOpen(true)}>
  <Menu size="sm" />
</Button>

<Drawer
  isOpen={open}
  onOpenChange={setOpen}
  side="start"
  aria-label="Navigation"
>
  <Sidebar>{/* existing pattern */}</Sidebar>
</Drawer>
```

| Prop                                      | Notes                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `isOpen` / `defaultOpen` / `onOpenChange` | React Aria overlay names. Controlled or uncontrolled                          |
| `side`                                    | `"start"` (default) \| `"end"`. Logical; `useLocale` maps physical left/right |
| `isDismissable`                           | Default `true`. Tap scrim, swipe toward the edge, Escape                      |
| `children`                                | The panel. Width **240px**, cap ~85vw                                         |
| `aria-label` / `aria-labelledby`          | Dialog name. Visually hidden title from `aria-label` is fine                  |

Out of the public API: drag/snap props, cookies, breakpoint hooks, `DrawerTrigger` / Header / Footer / Rail, edge-swipe-to-open.

## Behavior

- Flush square panel: `background.element`, no radius, outside 1px `borderColor.outline` ring (`box-shadow: 0 0 0 1px`). Nested Sidebar/nav drops its own radius and shadow.
- Scrim is black alpha in both themes. Content does not shrink or push. Focus is trapped.
- Panel opening and closing use the same critically damped spring.
- Nested vertical scroll wins until horizontal intent is clear.
- A swipe-dismiss seeds that spring with its release velocity, preserving
  gesture momentum instead of restarting from rest.
- `prefers-reduced-motion`: no rubber-band drag; opacity-only open/close (`useReducedMotion`, same as [Crossfade](crossfade.md)).
- Choosing a nav item should close the drawer in **app wiring**, not via a Drawer prop.

Keep `Sidebar` / `SidebarSection` / `SidebarItem` as the static 240px nav pattern. Drawer is the mobile shell that content sits in. A nested `nav` (including Sidebar) fills the panel without a second card.

The gallery chrome uses Drawer under a compact media query in gallery CSS only — not a public breakpoint token. Email and Calendar layouts are different; leave them alone.
