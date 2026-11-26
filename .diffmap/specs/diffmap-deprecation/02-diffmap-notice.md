# ⏳ Phase 2: Diffmap 0.14.0 notice

The repository root is now the product-doc package, so diffmap's last release needs its own small folder. `legacy/diffmap/` holds a package named `@tanishqkancharla/diffmap` at version 0.14.0, above every published version (0.13.2 is the highest). It has no dependencies and one file that prints the notice for any command.

```js [legacy/diffmap/bin.js (proposed)]
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
// [!note L5-L8] Written to the agent, which is usually the reader. It offers the migration and waits for the user's OK, because removing a skill is the user's call.
// [!note L2] Repeats the user's own arguments, so `serve .diffmap/specs/x/` becomes `npx product-doc@latest serve .diffmap/specs/x/`.
// [!note L15] Exits with an error so scripts and agents notice. The CLI itself never runs product-doc or changes skills.
```

The package's README says the same thing, so the npm page shows it too. Diffmap 0.14.0 sends no telemetry, so legacy usage stops showing in PostHog once people move; npm download counts are what's left to watch.

## The old skill points forward

```diff [skills/generate-diffmap/SKILL.md]
-# Living spec
-
-Before you write or update a spec, run this from the repo root and follow what it prints:
-
-npx @tanishqkancharla/diffmap guide
+# Diffmap is deprecated
+
+Before anything else, tell the user diffmap is deprecated. Offer to switch them to product-doc, and with their OK run:
+
+npx skills remove generate-diffmap
+npx skills add tanishqkancharla/diffmap --skill generate-product-doc
+
+Their `.diffmap/specs/` documents keep working. To keep going now, run `npx product-doc@latest guide` from the repo root and follow what it prints.
```

People who never update the skill still hit the 0.14.0 notice, with the same ask, the next time it runs.

## Phase goals

- An agent with the old skill and 0.13.0 cached runs `npx @tanishqkancharla/diffmap guide`. It gets 0.14.0, tells the user, and offers to remove `generate-diffmap` and install `generate-product-doc` for them. With their OK it runs both commands, then runs `npx product-doc@latest guide` and keeps working on the same `.diffmap/specs/` documents.
- Someone who runs `npx @tanishqkancharla/diffmap serve .diffmap/specs/x/` sees `npx product-doc@latest serve .diffmap/specs/x/` to copy.
- Someone with a global install runs `diffmap update`, gets 0.14.0, and sees the notice on the next command.

## Proof

I ran a local npm registry ([Verdaccio](https://verdaccio.org)) that mirrors npmjs.org, so nothing reached the real registry. An old user's project held this document in `.diffmap/specs/`.

```sh [Same user, same npx cache, npm 11.15]
$ npx -y @tanishqkancharla/diffmap --version   # before 0.14.0 exists
0.13.0
# publish legacy/diffmap (0.14.0) to the local registry
$ npx -y @tanishqkancharla/diffmap guide
diffmap is deprecated. Use product-doc instead.
...
To keep going now, run:
  npx product-doc@latest guide
[exit code 1]
$ npx -y product-doc@latest serve .diffmap/specs/diffmap-deprecation/
GET / -> HTTP 200, cover "# Deprecate diffmap"
```

The same cache check passes on npm 10.9.2, the npm that ships with Node 22: 0.13.0 while it was `latest`, then the 0.14.0 notice from the same cache once 0.14.0 was published. Global installs that run `diffmap update` were not tested, because that command reads the real registry. I will check it after release.

```changes
5c4400f
legacy/diffmap/bin.js
legacy/diffmap/package.json
legacy/diffmap/README.md
skills/generate-diffmap/SKILL.md
```
