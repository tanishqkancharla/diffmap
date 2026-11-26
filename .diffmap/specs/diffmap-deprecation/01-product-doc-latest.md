# ⏳ Phase 1: Always the latest product-doc

Today the skill runs `npx product-doc guide`. In a clean setup that already gets the newest release, because npx checks the registry when the command names only the package. But when product-doc is installed globally or in the project, npx runs that installed copy and never checks for a newer one. Adding `@latest` makes npx compare against the registry every time.

I checked this in the orb with product-doc 0.16.0 installed globally:

```sh [Older global install, run from an empty folder]
$ npx -y product-doc --version
0.16.0
$ npx -y product-doc@latest --version
0.17.0
```

## The change

```diff [skills/generate-product-doc/SKILL.md]
-npx product-doc guide
+npx product-doc@latest guide

-The CLI guide owns the authoring instructions and document format, keeping them version-matched to the viewer. If `guide` is unavailable in an installed release, run `npx product-doc update`, then retry.
+The CLI guide owns the authoring instructions and document format, keeping them version-matched to the viewer. `@latest` makes npx use the newest release even when an older one is installed.
```

The guide's commands get the same suffix, so the viewer that serves a document matches the guide that wrote it. The line about the two skills coexisting becomes a line saying diffmap is deprecated.

```diff [guide.md]
-npx product-doc validate .diffmap/specs/<name>/ # check syntax, diagrams, notes, and page names
-npx product-doc list                            # reuse the URL if already served
-npx product-doc serve .diffmap/specs/<name>/
+npx product-doc@latest validate .diffmap/specs/<name>/ # check syntax, diagrams, notes, and page names
+npx product-doc@latest list                            # reuse the URL if already served
+npx product-doc@latest serve .diffmap/specs/<name>/
```

The same edit applies to the `guide <topic>` lines in [[guide.md]] and [[guide/ui.md]], [[guide/callstack.md]], and the README and website copy that quotes the skill's command ([[README.md#L25]], [[src/website/content.ts#L62]], [[src/website/content.ts#L114]], [[src/website/build.tsx#L74]]). No new tests. The existing guide test in [[src/cli.test.ts]] now looks for `npx product-doc@latest guide <topic>`, and `npm run check` passes (107 tests).

## Fix the migration page

[productdoc.dev/docs/migration](https://productdoc.dev/docs/migration) still says Diffmap "is not being retired as part of this rollout" and that `generate-diffmap` "remains available too". That contradicts the deprecation. Its text lives in [[src/website/content.ts#L138-L159]]. The proposed page replaces it:

```md [/docs/migration (proposed)]
# Coming from Diffmap

Diffmap is deprecated. Use Productdoc instead. It is the same tool under a new name, and it also explains existing systems and plans future work.

## Switch over

1. Remove the old skill: npx skills remove generate-diffmap
2. Install the new one: npx skills add tanishqkancharla/diffmap --skill generate-product-doc
3. Ask your agent for a document as before. The skill runs npx product-doc@latest guide.

## What stays put

Keep documents in .diffmap/specs/. Productdoc reads them as they are. Shared diffmap.dev links keep opening their documents. DIFFMAP_TELEMETRY and the diffmap configuration directory still apply, so your privacy choices carry over.

## What happens to diffmap

The last diffmap release, 0.14.0, prints a notice instead of running. It asks your agent to tell you and offer this switch. npm also marks every diffmap version as deprecated.
```

Its description changes to "Switch from Diffmap to Productdoc and keep your documents, shared links, and settings." The README's "Migrating from Diffmap" section ([[README.md#L34-L47]]) was rewritten to say "Diffmap is deprecated" by [the README thread](https://ampcode.com/threads/T-01a218c7-21fb-73ff-99cc-72b611835c3e). That landed first; this change builds on it without rewording it, and only replaces "Existing installs do not migrate automatically" with the same three switch-over steps, because the 0.14.0 notice now offers that migration. "No legacy binary alias" stays, since it is still true.

The site is on Vercel, and no workflow in this repository deploys it, so it most likely deploys whenever `main` changes. The page should not go live before diffmap 0.14.0 does, or it would describe a notice nobody can see yet. So I push the website copy in its own commit after you approve 0.14.0 ([Phase 3](03-npm-deprecation.md)).

## Phase goals

- An agent on a machine with an old product-doc installed runs the skill and gets the newest guide and viewer.

  ```sh
  $ npx product-doc@latest guide   # prints the 0.17.1 guide, not the installed 0.16.0 one
  ```

- The skill change reaches people as soon as it is on `main`. The guide change reaches them once product-doc 0.17.1 is approved on npm, through the `Release 0.17.1` commit that R0002 requires.

Built in `5c4400f` with the release commit `6ed9a7e`. The migration page is its own commit, `b2936d1`, to push after diffmap 0.14.0 is approved. The README switch-over steps ride in the same commit, on top of the README thread's banner.

```changes
6f1dfed..b2936d1
skills/generate-product-doc/SKILL.md
guide.md
guide/callstack.md
guide/ui.md
src/cli.test.ts
README.md
src/website/content.ts
src/website/build.tsx
skills/generate-diffmap/SKILL.md
legacy/diffmap/bin.js
legacy/diffmap/package.json
legacy/diffmap/README.md

ignore:
package.json
package-lock.json
```
