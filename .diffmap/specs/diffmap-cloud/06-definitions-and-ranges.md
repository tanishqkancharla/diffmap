# Phase 5: Definitions and commit ranges

[Phase 1](02-publish-a-spec.md) shares the diffs and files a spec shows. Two features in the Diff panel still ask the local server for things a shared spec does not have: Cmd-click to a definition, and the commit range picker. This phase works out what each needs when the spec is shared, and says what stays local.

**Today**

Cmd-clicking a TypeScript or JavaScript name in the Diff panel asks `serve` for its definition ([[src/definitions.ts#findDefinition]]), which runs TypeScript over the whole repo. The range picker lists every commit on the branch and the uncommitted changes, from `serve`'s `/__diffmap/deltas`, and diffs whatever range the reader drags. Both only run when the viewer mode is `"local"` ([[src/viewer/SourceDiffPanel.tsx]], [[src/viewer/RangePicker.tsx]]).

**Proposed**

In a shared spec, Cmd-click works on any name in a file the spec shows, and opens its definition when that definition is in a file the spec shows, or in a file those files import. A name defined anywhere else says "Not in this shared spec" instead of doing nothing. The range picker offers the ranges the spec's pages use, and the whole range from the first to the last of them, instead of every commit.

## Definitions

`share` runs the same TypeScript lookup [[src/definitions.ts#findDefinition]] uses, once, over every file the spec shows. For each name, it records where its definition is, and uploads that table, plus the contents of each file a definition lands in, as the version's `definitions` blob:

```ts [The definitions blob]
type SharedDefinitions = {
  // "src/store.ts@a1b2c3d" → line → column → definition
  names: Record<string, Record<number, Record<number, { path: string; start: number; end: number }>>>;
  // files definitions land in that the spec does not already include
  files: Record<string, string>;
};
```

Following imports one step covers most clicks a reviewer makes, such as a helper or a type the changed code uses, without uploading the repo. `share` lists these extra files with the others it will make public, and the same checks for ignored files and keys apply. A spec whose table would pass 5 MB keeps the first 5 MB of names, in the order of the spec's review lists, and says so.

## Commit ranges

Every range the spec's pages use is already snapshotted for its changes cards and references. `share` adds one more snapshot, from the oldest commit to the newest, so the reader can see the whole change at once. Dragging an arbitrary range would need a snapshot of every pair of commits, so the picker in a shared spec offers only these ranges.

## What stays local

- Arbitrary commit ranges, and names whose definitions are outside the files the spec shows and their imports.
- **Close server**, since a shared spec has no server to close.

```changes

```
