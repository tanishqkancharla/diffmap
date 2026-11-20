# Phase 6: Definitions and commit ranges

Two Diff panel features that ask the local server, made to work on a shared link.

**Today:** Cmd-click runs TypeScript in `serve` ([[src/definitions.ts#findDefinition]]), and the range picker runs git.

**Proposed**

- **Definitions:** `publish` resolves every name in the shown files once, following imports one step, and uploads the table plus the files it lands in. Those files are listed as public like the rest. The table is capped at 5 MB.
- **Ranges:** the ranges the pages use, plus oldest-to-newest. The picker offers only those.
- **Stays local:** arbitrary ranges, definitions beyond one import, and Close server.

## Expected flows

**Jumping to a definition**

1. A reader opens the Diff panel on a shared link, and Cmd-clicks a function the change calls.
2. It opens where that function is defined, even when that file isn't otherwise in the document.
3. Cmd-clicking something defined further away says it's only available locally.

**Choosing a commit range**

1. A reader opens the range picker on a shared link.
2. It offers the ranges the pages use, and the whole change at once. Picking one shows that diff.
3. Ranges the document doesn't use aren't offered.

**Seeing what definitions make public**

1. You publish a document. The list of source files now public includes the files definitions land in.
2. A file with a key in it is refused, as in Phase 1.

## Todos

- [ ] Build the definitions table in `publish`
- [ ] List the extra files under the same checks
- [ ] Cmd-click reads the table in the shared viewer
- [ ] Snapshot the full range, and limit the picker
- [ ] Hide Close server when shared

```changes

```
