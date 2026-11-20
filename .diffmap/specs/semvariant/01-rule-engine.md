# ✅ Phase 1: Port the local rule engine

The [overview](README.md) describes one source of repository rules. This phase ports Halo's standalone engine without changing product-doc's public CLI or application behavior. **Implemented and verified; included in the atomic port commit below.**

**Before:** AGENTS.md was hand-authored. Diffmap had no rule registry, generated guidance indexes, or path-based rule lookup.

**Now:** local contributors run `npm run semvariant -- <command>`. The implementation lives in [[tools/semvariant/cli.ts]] and [[tools/semvariant/semvariant.ts]]; canonical rules live in tools/semvariant/rules. The npm package's existing published file list excludes this repository-only tool.

## Keep Halo's retrieval contract

| Command                                   | What the contributor gets                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `context src/viewer/ViewerApp.tsx`        | Titles for rules assigned to the path's directory and ancestors.                             |
| `context src/viewer/ViewerApp.tsx --full` | The same selection, with full rule records.                                                  |
| `context --staged`                        | Rules for staged changes, including deleted paths and both sides of a rename.                |
| `context --diff main`                     | Rules for the working-tree difference from the resolved revision, not a merge-base PR range. |
| `show R0001 R0002`                        | Full matching records; IDs are case-insensitive.                                             |
| `search viewer release`                   | Rules containing either substring in title or body, case-insensitively.                      |
| `generate`                                | Repair missing or changed generated guides and delete stale generated guides.                |
| `check`                                   | Validate rule structure and report projection drift without writing.                         |

Selecting a directory includes its own and ancestor rules, **not** every descendant's rules. Untracked changes need explicit paths or staging. Rules selected by several paths appear only once. Halo returns “No matching rules.” for unknown IDs; retain that behavior rather than claiming typo detection it does not have.

All retrieval commands, including help, first require valid rules and current projections in Halo. Preserve that fail-closed behavior; generation is the repair path.

Illustrative selection logic:

```ts
const scopes = ancestorsOfSelectedPaths(paths);
const applicable = rules.filter((rule) =>
  rule.guides.some((directory) => scopes.has(directory)),
);
if (projectionsDifferFromRules()) return driftError;
return full ? applicable : applicable.map(titleAndId);
```

## Keep Halo's write protections

A rule has a filename such as R0001.md, frontmatter containing only a nonempty, duplicate-free guides list, and one nonempty H1 outside fenced code. Rules can use ordinary Markdown bodies and examples with headings inside code fences.

Scopes must be existing directories inside the repository. Reject traversal, absolute scopes, symlink components, and excluded .git, node_modules, and data directories. Context also rejects paths escaping the repository, including symlink escapes.

Guide discovery uses Git's tracked and unignored files, respects nested ignore rules, and skips nested repositories and symlinks. Generated files carry an ownership marker. Generation refuses an authored AGENTS.md collision; it may replace or remove only generator-owned files. CRLF normalization avoids false drift on Windows. Writes use temporary sibling files and rename; this is not a transaction across the whole repository.

## Adapt execution, not architecture

Reuse Halo's TypeScript engine and errore errors; diffmap already depends on errore. Run the entry point with the installed tsx runtime, rather than depending on native Node type stripping across diffmap's supported Node versions. Use npm command text, diffmap naming, a dedicated no-emit tool tsconfig extending the root config, and tool-specific lint and formatting checks. The existing product build still compiles only its own source entries.

Halo is Apache-2.0 licensed while diffmap is MIT licensed. Preserve the upstream license and any applicable notices with copied tool source, identify the pinned source commit, and mark local modifications; do not relabel the copied engine as MIT-only. No workspace package, Turborepo task, service, new runtime dependency, or public export is needed.

## Verification

The seven tests in [[tools/semvariant/semvariant.test.ts]] execute the real CLI in disposable Git repositories. They passed retrieval, duplicate-scope selection, Git renames and deletions, malformed rule records, authored collisions, stale-file removal, ignored/nested-repository preservation, path escapes, fenced headings, and CRLF cases. [Phase 3](03-checks-and-proof.md#observed-proof) records the evidence and the planted implementation failure.

```changes
57d89e32042370d9b305264668a59155633def57
tools/semvariant/cli.ts
tools/semvariant/semvariant.ts
tools/semvariant/semvariant.test.ts
tools/semvariant/tsconfig.json
tools/semvariant/NOTICE
package.json
tools/semvariant/rules/R0001.md
tools/semvariant/rules/R0002.md
tools/semvariant/rules/R0003.md
tools/semvariant/rules/R0004.md
tools/semvariant/rules/R0005.md
tools/semvariant/rules/R0006.md
tools/semvariant/rules/R0007.md
tools/semvariant/rules/R0008.md
tools/semvariant/rules/R0009.md
tools/semvariant/rules/R0010.md
.agents/skills/retrieving-semvariant/SKILL.md
.agents/skills/managing-diffmap-repo/SKILL.md
.oxfmtrc.json

ignore:
tools/semvariant/LICENSE
AGENTS.md
.diffmap/AGENTS.md
src/gist/AGENTS.md
src/github/AGENTS.md
src/host/AGENTS.md
src/landing/AGENTS.md
src/preview/AGENTS.md
src/viewer/AGENTS.md
src/website/AGENTS.md
tools/semvariant/AGENTS.md
```
