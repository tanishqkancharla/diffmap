# Agent notes

## Releasing

Merging or pushing to `main` does not publish a new package unless the version
in `package.json` is bumped. The `Publish to npm` workflow runs on every push
to `main` but skips when that version is already on npm or staged.

To release, bump the version in its own commit (`npm version <x.y.z>
--no-git-tag-version`, then commit `package.json` and `package-lock.json` as
`Release <x.y.z>`). After it reaches `main`, the workflow stages the package
with `npm stage publish`, and a maintainer must approve it on npmjs.com before
it goes live.

## Running the viewer from a checkout

`serve` serves the prebuilt viewer from `viewer-dist/` and runs compiled code
from `lib/`; `npm run build:viewer` and `npm run build:lib` write them, and
`npm test` and `npm pack` run both. While changing the viewer, use
`npm run cli -- serve <file>` instead: it sets `DIFFMAP_DEV=1`, which serves
the viewer from `src/` through Vite with hot reload.
