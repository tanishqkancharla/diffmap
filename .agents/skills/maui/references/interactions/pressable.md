# Pressable

Import from `"@tanishqkancharla/maui"`. Maui directly re-exports React Aria's `Pressable` as a shared interaction primitive, not a menu-specific component. Prefer Maui `Button` when you do not need a custom control.

## Press handling

`Pressable` adds normalized press and focus behavior to one custom element, without styling or an extra DOM wrapper. `onPress` handles mouse, touch, keyboard, and screen-reader activation; React Aria handles cancellation, including scrolling away during a touch interaction.

```tsx
import { Pressable } from "@tanishqkancharla/maui";

<Pressable onPress={handleAction}>
  <button type="button">Custom control</button>
</Pressable>;
```

## Custom triggers

Wrap a custom target in `Pressable` to connect it to React Aria triggers, including ordinary `MenuTrigger` dropdowns, context menus, and React Aria's `DialogTrigger`. Maui `Button` already handles trigger integration and needs no `Pressable` wrapper. See [Menu](../components/menu.md) for the context-menu recipe.

## Child requirements

- The single child must be a semantic interactive element or have an appropriate interactive ARIA role.
- Custom components must forward their ref and spread props onto that element.
- Apply your own styling with Maui tokens, including `focusRing()` for visible keyboard focus.
