# Record productdoc identity and migration

The [overview](README.md) describes productdoc as the standalone product going forward. This page records the chosen identity and temporary migration boundary, not a two-product architecture.

## Confirmed

- Public product: **productdoc**. It succeeds Diffmap and broadens the scope beyond diff review to general-purpose visual documents.
- Skill: **generate-product-doc**, a short pointer to the CLI guide. `generate-diffmap` coexists temporarily; users will be asked to migrate later.
- npm package: **product-doc**. Executable default: **product-doc**. The hyphenated identifiers do not make the public brand a second product.
- Website: **productdoc.dev**, purchased according to Tanishq. DNS and hosting have not been configured or verified here.
- Initial onboarding test: **Amp**, chosen as the easiest available target. Other agents are unverified, not excluded.

## Not established yet

The initial unscoped lookup returned E404, not proof of ownership. After explicit approval and npm sign-in, [the first stage](14-runtime-release.md) claimed `product-doc` under `tanishqkancharla`; only npm's 0.0.0-stage placeholder is public. Candidate 0.13.1 is staged, not approved or released. Trusted publishing, website deployment and migration announcement remain future work.

## Implementation boundary

Rename the existing product and package rather than adding a permanent second branded distribution or marketing the new product as dependent on Diffmap. Keep existing documents, paths and links usable through migration. The stub may contain a temporary legacy-command note while the successor package is unavailable; the substantive authoring instructions belong in [[guide.md]].

Do not automatically deprecate the old package, delete the old skill, redirect domains, or rewrite published releases. The migration plan should name each shared/external action for approval. Local work no longer needs another naming decision.

This contract feeds [CLI rename](07-branded-cli.md), [package preparation](08-product-package.md), and [website adaptation](04-product-doc-website.md).

```changes

```
