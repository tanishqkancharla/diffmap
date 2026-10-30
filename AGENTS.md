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
