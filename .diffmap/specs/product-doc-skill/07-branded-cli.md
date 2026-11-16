# ⏳ Rename the CLI to productdoc

[The identity decision](06-launch-identity.md) establishes productdoc as the standalone successor. The primary CLI is now renamed locally, not released. There is one runtime, not a brand-configurable framework or a second wrapper product.

## Before

CLI help, examples, error prose, and the updater all identified as Diffmap. A new skill name alone would still send users back to the old product at every command.

## Built locally

`product-doc` is the executable. Help describes explaining systems, planning work, and reviewing changes. The updater checks and installs only `product-doc`; both `update` and `--update` retain the existing behavior. The guide and README use the successor commands. The stub no longer falls back to an old published guide that may lack the new authoring instructions.

These are actual local changes, not proposed APIs:

```diff
-const cli = Cli.create("diffmap", {
-  description: "Serve a spec locally, or share it as a gist",
+const cli = Cli.create("product-doc", {
+  description: "Explain systems, plan work, and review changes as visual documents",
```

```diff
-export const packageName = "@tanishqkancharla/diffmap";
+export const packageName = "product-doc";
```

Illustrative user-level behavior, not another API:

```tsx
const document = existingDocument; // no copy or directory migration
const preview = productdoc.serve(document);
const updateTarget = "product-doc@latest";
```

## What stays compatible

Existing `.diffmap/specs` paths, document format, internal HTTP routes, registry/config storage, anonymous ID, privacy settings, and exported error type names stay unchanged. Sharing still uses the working diffmap.dev host, not an unimplemented productdoc.dev viewer. Browser titles continue to come from each document's README.

No `diffmap` binary alias is added to the successor package. Old published packages and the legacy skill are untouched; users choose when to migrate. This does not promise two independently maintained runtimes.

## Evidence and review priority

`npm test`: **70 passed, 0 failed** after updating the five expected error-message strings. The new checks cover help identity and the updater's registry/command target for npm, pnpm, bun, npx, and unknown installations. All update/network effects are intercepted. The [packed-artifact page](08-product-package.md) checks the installed executable and a real local server.

**Important:** [[src/cli.ts]], [[src/update.ts]], [[src/telemetry.ts]], [[guide.md]], [[skills/generate-product-doc/SKILL.md]], and [[README.md]]. **Supporting:** [[src/errors.ts]] changes user-facing prefixes without renaming public error types; [[src/parseViewer.test.ts]], [[src/cli.test.ts]], and [[src/update.test.ts]] verify the contract.

No commit exists yet, so the commit card remains empty. A later commit summary should list the important paths first and use `ignore:` for genuinely safe-to-skip supporting changes, not hide behavioral tests.

```changes

```
