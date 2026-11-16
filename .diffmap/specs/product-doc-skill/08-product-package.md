# ⏳ Package the productdoc runtime

[The CLI rename](07-branded-cli.md) establishes the primary identity. The current implementation now packs as `product-doc`, with executable `product-doc`. This is a verified local candidate, not a published npm release.

## Before

The package and bin mapping still installed Diffmap, even though the successor skill pointed at productdoc. Testing only source commands would miss missing compiled files, viewer assets, or a wrong executable mapping.

## Built locally

The root manifest and lockfile identify the successor. The single existing implementation, CLI guide, library, and prebuilt viewer remain the release artifact. No copied renderer, wrapper package, or legacy executable alias is introduced. Node >=22 remains the supported runtime. Version stays 0.13.1 until a deliberate release-version decision; no release bump is included.

Actual manifest change:

```diff
-  "name": "@tanishqkancharla/diffmap",
+  "name": "product-doc",
   "version": "0.13.1",
-  "description": "Serve a spec or code walkthrough as a local page",
+  "description": "Visual documents to explain systems, plan work, and review changes",
```

```diff
   "bin": {
-    "diffmap": "bin.js"
+    "product-doc": "bin.js"
   },
```

## Installed-artifact evidence

`npm pack` built the library and viewer and produced a 3.1 MB candidate with 556 files. Installing that tarball into a clean temporary directory with lifecycle scripts disabled succeeded. Plain Node ran the installed executable; no source TypeScript loader or checkout viewer was needed.

A temporary smoke check verified package/bin identity, help and version, exact bundled guide delivery, validation of a two-page document, the updater's new registry and command target through an intercepted transport, viewer JavaScript assets, README-derived HTML title, Markdown negotiation and page routing, list discovery, and shutdown. Decisive output:

```text
PASS packed install: identity, bin, version, help, guide, 2-page validation, intercepted update, viewer assets, README title, Markdown/page routes, list, shutdown
```

Illustrative acceptance boundary:

```tsx
const installed = installLocalTarball(candidate); // not npm publication
expect(installed.serve(existingDocument).title).toBe(
  existingDocument.readmeTitle,
);
expect(installed.updateTarget).toBe("product-doc@latest");
```

No npm writes, global installs, legacy package changes, or live telemetry occurred. The public Git skill installer, fresh-agent triggering, npm publishing rights, and release trust are still unverified. Those are [clean onboarding](13-clean-onboarding.md), [release setup](12-release-pipeline.md), and [publication](14-runtime-release.md), not claims made by this tarball check.

## Review priority

**Important:** [[package.json]] defines the installation contract. **Supporting:** [[package-lock.json]] mirrors only root name/bin metadata; build outputs are generated rather than committed. The package keeps the existing GitHub repository URL. The legacy skill has no local diff.

```changes

```
