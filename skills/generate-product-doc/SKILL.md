---
name: generate-product-doc
description: Create general-purpose visual documents with productdoc. Use to explain existing systems, plan future work, or review changes through user behavior, workflows, or involved services.
---

# Productdoc

Before writing or updating a document, run this from the repository root and follow what it prints:

```sh
npx product-doc guide
```

The CLI guide owns the authoring instructions and document format, keeping them version-matched to the viewer. If `guide` is unavailable in an installed release, run `npx product-doc update`, then retry.

**Migration:** productdoc succeeds Diffmap; the two skills coexist temporarily. Keep existing documents rather than creating migration copies.
