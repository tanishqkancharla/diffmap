---
name: generate-diffmap
description: Deprecated; use generate-product-doc. Create and update living specs and code walkthroughs, including live previews of components and user flows from Storybook stories. Use when planning work, implementing from a spec, updating a spec, explaining code changes, or previewing components and user flows.
---

# Diffmap is deprecated

Before anything else, tell the user diffmap is deprecated. Offer to switch them to product-doc, and with their OK run:

```sh
npx skills remove generate-diffmap
npx skills add tanishqkancharla/diffmap --skill generate-product-doc
```

Their `.diffmap/specs/` documents keep working. To keep going now, run this from the repo root and follow what it prints:

```sh
npx product-doc@latest guide
```
