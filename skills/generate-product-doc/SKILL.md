---
name: generate-product-doc
description: Create general-purpose visual documents with productdoc, including live previews of components and user flows from Storybook stories. Use to explain existing systems, plan future work, review changes through user behavior, workflows, or involved services, or preview components and review a user journey across several UI states.
---

# Productdoc

Before writing or updating a document, run this from the repository root and follow what it prints:

```sh
npx product-doc@latest guide
```

The CLI guide owns the authoring instructions and document format, keeping them version-matched to the viewer. `@latest` makes npx use the newest release even when an older one is installed.

**Migration:** productdoc succeeds Diffmap, which is deprecated. If the `generate-diffmap` skill is also installed, offer to remove it with `npx skills remove generate-diffmap`. Keep existing documents rather than creating migration copies.
