# diffmap is deprecated

Use [product-doc](https://www.npmjs.com/package/product-doc) instead. It is the same tool under a new name, and it also explains existing systems and plans future work.

```sh
npx skills remove generate-diffmap
npx skills add tanishqkancharla/diffmap --skill generate-product-doc
```

Then ask your agent for a document as before. The skill runs `npx product-doc@latest guide`. Your `.diffmap/specs/` documents keep working.

This last release, 0.14.0, only prints this notice. More at [productdoc.dev](https://productdoc.dev).
