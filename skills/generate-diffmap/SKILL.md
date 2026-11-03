---
name: generate-diffmap
description: Create and update living specs and code walkthroughs with diffmap. Use when planning work, implementing from a spec, updating a spec, or explaining code changes.
---

# Living spec

Before you write or update a spec, run this from the repo root and follow what it prints:

```sh
npx @tanishqkancharla/diffmap guide
```

The guide comes from the same diffmap version that serves the spec, so its syntax always matches the viewer. If `guide` is not a command, the installed diffmap is too old: run `npx @tanishqkancharla/diffmap update`, then run `guide` again.
