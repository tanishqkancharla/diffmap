# ✅ Phase 3: Reject drift and prove the boundary

[Phase 2](02-diffmap-rules.md) establishes the rule sources and scopes. This phase makes broken records or stale indexes fail the repository check, then demonstrates the contract with failures as well as successes. **Implemented and verified; included in the same atomic port commit as the earlier phases.**

**Before:** package.json had lint, formatting, typecheck, and an explicit node:test file list. The publish workflow ran tests only when deciding to stage a new version on main. There was no separate checked-in PR validation workflow.

**Now:** [[package.json]] follows Halo's command structure: `npm run check` runs semvariant validation first, then typecheck, lint, formatting, and `npm test`. `npm run check-affected` aliases `check`; because diffmap is a single package, both run the full package checks without Turbo. The existing `prepublishOnly` hook reuses this group. The semvariant script validates rules and generated guides, typechecks, lints, format-checks the tool, and runs its CLI tests. [[.oxfmtrc.json]] excludes generated AGENTS.md paths because the generator owns their bytes. The separate Semvariant GitHub workflow was removed at review; the existing release workflow and npm approval gate are unchanged.

Illustrative check composition:

```ts
function checkSemvariant(): ExitCode {
  requireSuccess(validateRulesAndGeneratedGuides());
  requireSuccess(typecheckTool());
  requireSuccess(lintTool());
  requireSuccess(formatCheckTool());
  requireSuccess(testCliContract());
  return 0;
}
```

The aggregate check stops on the first failed command. There is no new PR workflow, branch protection, or affected-file selection within this package. It includes the viewer/library builds already required by `npm test`; it does not publish or deploy anything.

## What the lint investigation found

Halo's semvariant commit added validation of its own TypeScript tool and excluded generated guides from formatting. It did **not** introduce the repository's existing anti-slop lint suite. That suite lives separately under tools/oxlint and is registered in Halo's .oxlintrc.json.

I inspected the registration and representative rules, including CSS-import restrictions, module-mocking restrictions, and required SAFETY comments for type assertions. These are syntactic policies, not semvariant's prose enforcement. Copying them would add @oxlint/plugins, change code policy across diffmap, and flag patterns unrelated to the guidance port. For example, diffmap currently loads its viewer stylesheet from [[src/viewer/main.tsx]].

Keep diffmap's existing Oxlint configuration. Extend its reach to the new tool via semvariant:check; do not silently import Halo's custom plugins, type-aware lint dependencies, test-report parser, or hosted review tooling. A broader lint-policy port can be proposed separately if wanted.

## Approved proof cases

The proof executes the real CLI in isolated Git repositories, not mocks of the parser or only generated-file inspections. Expected selections are independent of the implementation. The ten cases below were specified before implementation and are retained here to compare with the observed results.

| Scenario            | Positive result                                                           | Negative control that must differ                                                                       |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Scope inheritance   | Root + viewer scopes, deduplicated across selected files.                 | A parser file excludes viewer guidance; selecting src does not pull in descendants.                     |
| Full-body retrieval | context --full and show return rationale and exceptions.                  | Default context returns an index, not every body.                                                       |
| Search              | Mixed-case queries match either term in title or body.                    | Unmatched terms return the documented empty result.                                                     |
| Generation          | Missing projections are created; a second run changes no bytes.           | Editing one generated title makes check and retrieval fail until regenerated.                           |
| Rule validity       | Block and inline guide lists, CRLF files, and fenced H1 examples work.    | Empty/duplicate/invalid guides, bad filenames, extra frontmatter, and multiple real H1s fail.           |
| Ownership           | Edited generated guides repair; retired scopes remove stale owned guides. | Authored target guides cause refusal and remain byte-identical; unrelated authored guides survive.      |
| Filesystem safety   | Ordinary in-repository scopes work.                                       | Absolute/traversing scopes, missing scope directories, and symlink escapes fail without outside writes. |
| Git selection       | Staged changes include deletion paths and both rename scopes.             | An unstaged untracked file is absent from staged context and present when explicitly selected.          |
| Guide discovery     | Tracked and unignored generated guides are considered.                    | Ignored trees and nested repositories are left untouched.                                               |
| Integration         | npm run semvariant:check passes on the final checkout.                    | A temporary projection mutation causes that same command to exit nonzero; restoring it passes.          |

Seven durable tests in [[tools/semvariant/semvariant.test.ts]] protect observable CLI behavior using the existing node:test/tsx tooling. Both `npm run semvariant:check` and the aggregate `npm run check` run them. This deliberately differs from Halo's temporary-only migration tests. Fixture repositories are deleted after the tests.

## Observed proof

Verified through real CLI processes and filesystem/Git operations on the local Linux stack, with no mocked parser or generator. Read the [captured proof transcript](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/proof.log). Its rerunnable harness remains at `.amp/in/orb-backup/semvariant/prove.mjs`; the durable regression tests are repository source, not disposable proof scripts. Capture links download files from this running viewer; they are local evidence, not files shipped in the npm package.

- **Starting state:** the same `npm run semvariant -- check` entry point failed with a missing npm script before the port. See the [starting-state log](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/before.log).
- **Aggregate repository check:** the final Halo-style `npm run check-affected` delegated to `npm run check`, passed semvariant validation and all seven CLI tests first, then typecheck, lint, repository formatting, viewer/library builds, and all 97 product tests. The [captured full run](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/halo-style-check.log) shows every stage. This run used the process-only fixture-signing override described below; no repository or global Git settings changed. `prepublishOnly` reuses the same `check` command.
- **Scopes:** independently specified ID lists matched viewer, parser, document, and tool selections exactly. Default context excluded bodies; full retrieval included them; mixed-case OR search and empty search results passed in the CLI suite.
- **Drift and repair:** byte-idempotent generation passed. Deliberately changing one root-guide title made both the full integration command and context retrieval exit 1 with `changed: AGENTS.md`. Generation restored the exact original bytes; the same integration command then exited 0 and passed all seven CLI tests.
- **Ownership and safety:** authored collisions caused refusal without changing authored bytes or writing other guides. Retiring a rule removed only its owned stale guide; unrelated authored guides, ignored trees, and nested repositories survived. Invalid records, excluded scopes, traversal, missing directories, symlink escapes, and option-like revisions were rejected. CRLF and fenced H1 controls passed.
- **Git changes:** a real staged rename from viewer to parser selected both scopes and both paths. A staged deletion remained selected; an untracked file was absent until explicitly selected.
- **Test sensitivity:** in a disposable copy, changing selection to return only root-scoped rules made the existing retrieval regression fail with actual `[R0001]` versus expected `[R0001, R0002]`. That copy was deleted. The real implementation still passed.
- **Existing behavior:** the [product test log](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/product-tests-rerun.log) records 97 passing existing product tests. [Typecheck](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/typecheck.log), [lint](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/lint.log), and [repository formatting](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/format.log) passed. No existing test assertions or product runtime code changed.
- **Runtime coverage:** the complete semvariant:check command passed all seven tests on Node 22.23.5, Node 24.22.3, and Node 26.13.1. See the [Node 22](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/node22.log), [Node 24](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/node24.log), and [Node 26](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/cli-tests.log) logs. These were Linux runs, not a claim of native Windows or macOS testing.
- **Packaging:** the [packaging log](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/packaging.log) records a dry run containing 482 files, including compiled CLI and viewer, and excluding repository tooling, rules, skills, and generated guides. Version remains 0.14.2; no package was published.

### Setup corrections and limits

The first CLI test run reached six passing cases but its fixture commit inherited the orb's signed-commit setting. The fixture now disables signing only in its own disposable repository. That leaves contributor signing configuration unchanged.

The first existing product-suite run had ten fixture-signing failures and one config-discovery failure because the in-repository TMPDIR made a no-config fixture inherit the repository's `.diffmap/config.json`. The successful rerun used the suite's normal system temp directory and process-only `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=commit.gpgsign`, `GIT_CONFIG_VALUE_0=false`. No assertions were weakened or production settings changed. The [failed run is retained](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/product-tests.log).

An initial package inspection raced the product test's viewer rebuild and saw no viewer files. It was discarded and repeated after the build/test command finished; the [successful manifest](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/package-contents.json) is retained.

## What “irrefutable proof” can and cannot mean

The observed failures establish that malformed sources, drift, unsafe paths, and authored collisions are rejected in the cases exercised. A positive control after restoration establishes repair. Types and the existing suite check integration risk.

No deterministic test proves an agent will obey every prose rule. We will not claim that it does. A live agent comparison would require a separately approved evaluation plan specifying cases, model, and thread budget; it is not needed to prove the engine's executable contract.

## Approval and shipping

The proposal was validated, rendered, and approved before implementation. This same document now records local implementation and observed proof.

The requester authorized committing all work, rebasing onto `origin/main`, running the full suite, and pushing. The implementation commit below rebased without conflicts. Pre-push revalidation is captured in the [shipping check log](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/shipping-check.log); final push status is recorded in the thread. No new PR workflow, version bump, npm staging, or manual deployment is part of this port.

```changes
57d89e32042370d9b305264668a59155633def57
package.json
.oxfmtrc.json
tools/semvariant/semvariant.test.ts
tools/semvariant/tsconfig.json
tools/semvariant/cli.ts
tools/semvariant/semvariant.ts
tools/semvariant/NOTICE
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
