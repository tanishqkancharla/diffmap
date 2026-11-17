# Phase 6: Definitions and commit ranges

Two Diff panel features that ask the local server, made to work on a shared link.

**Today:** Cmd-click runs TypeScript in `serve` ([[src/definitions.ts#findDefinition]]), and the range picker runs git.

**Proposed**

- **Definitions:** `publish` resolves every name in the shown files once, following imports one step, and uploads the table plus the files it lands in. Those files are listed as public like the rest. The table is capped at 5 MB.
- **Ranges:** the ranges the pages use, plus oldest-to-newest. The picker offers only those.
- **Stays local:** arbitrary ranges, definitions beyond one import, and Close server.

## Todos

- [ ] Build the definitions table in `publish`
- [ ] List the extra files under the same checks
- [ ] Cmd-click reads the table in the shared viewer
- [ ] Snapshot the full range, and limit the picker
- [ ] Hide Close server when shared

```changes

```
