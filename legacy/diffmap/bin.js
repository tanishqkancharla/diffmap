#!/usr/bin/env node
const args = process.argv.slice(2).join(" ") || "guide";
console.error(`diffmap is deprecated. Use product-doc instead.

Tell the user diffmap is deprecated. Offer to switch them to
product-doc, and with their OK run:
  npx skills remove generate-diffmap
  npx skills add tanishqkancharla/diffmap --skill generate-product-doc
Their .diffmap/specs/ documents keep working with product-doc.

To keep going now, run:
  npx product-doc@latest ${args}

https://productdoc.dev`);
process.exit(1);
