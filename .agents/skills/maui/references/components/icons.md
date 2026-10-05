# Icons

Gallery: `/components/icons`. Import named icons from `"maui"` or `"maui/icons"`.

```ts
import { Search, Plus, ChevronLeft } from "maui";
import { Text as TextIcon, Badge as BadgeIcon } from "maui/icons";
```

Root-export collisions (use the `*Icon` alias from `"maui"`, or the original name from `"maui/icons"`):

`BadgeIcon`, `BlockquoteIcon`, `CodeIcon`, `H1Icon`, `H2Icon`, `H3Icon`, `LinkIcon`, `MenuIcon`, `PaddingIcon`, `SearchFieldIcon`, `SwitchIcon`, `TextIcon`.

Avoid `import { Icons } from "maui"` in app code — it pulls the full set. The JSX editor catalog uses `Icons.*` because every icon is in scope.

`IconProps`: SVG props + `size?: TextSize` (default `sm`). Size matches the text t-shirt scale (`2xs`–`xl`). Stroke and fill use `currentColor`.
