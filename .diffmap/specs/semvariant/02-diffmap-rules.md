# ✅ Phase 2: Give diffmap rules their own scopes

[Phase 1](01-rule-engine.md) supplies the engine. This phase gives it a small, explicit rule set drawn from diffmap's existing guidance and Halo's rule-maintenance discipline. **Implemented and verified; included in the same atomic port commit as Phase 1.**

**Before:** the authored root guide owned two concrete policies: staged npm releases and running the viewer from a checkout. Other procedures already lived in the Productdoc, repository-management, and Maui skills.

**Now:** those two policies live in full rule bodies without losing detail; retrieval and focused skill triggers appear in generated directory indexes. There is no new architecture handbook inferred from code patterns.

## Initial rule map

IDs below are diffmap-local identities. Halo IDs in the later table are provenance, not the new rule IDs. Read the canonical bodies in [[tools/semvariant/rules/R0001.md]] through [[tools/semvariant/rules/R0010.md]].

| Proposed rule                                                                                | Scope                                                                             | Meaning and source                                                                                                    |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| R0001: Read applicable full rules before editing or reviewing.                               | root                                                                              | Halo R0001, adapted to this package and its local retrieval skill.                                                    |
| R0002: Release product-doc through a separate version commit and staged npm approval.        | root                                                                              | Preserve the full Releasing section of [[AGENTS.md]], including both package files and the maintainer's npm approval. |
| R0003: Use the source viewer when developing from a checkout.                                | root                                                                              | Preserve the full checkout section of [[AGENTS.md]]: compiled lib and viewer-dist versus the source-serving CLI.      |
| R0004: Use the Productdoc skill for repository specs and walkthroughs.                       | .diffmap                                                                          | Link the existing Productdoc skill; do not copy its changing authoring guide.                                         |
| R0005: Use the repository-management skill for PRs, issue replies, and releases.             | root                                                                              | Point to the existing skill and retain its ownership of user-facing descriptions and release procedures.              |
| R0006: Load the Maui skill before changing application UI.                                   | src/viewer, src/landing, src/gist, src/github, src/host, src/preview, src/website | Adapt Halo R0052 to diffmap's real UI locations. No design-system migration is implied.                               |
| R0007: Generate guidance indexes from one canonical rule source.                             | tools/semvariant                                                                  | Halo R0054: format, stable IDs, projections, collision migration, regeneration and checking.                          |
| R0008: Give each rule one complete claim and explain its judgment.                           | tools/semvariant                                                                  | Halo R0055: titles must make sense without bodies; bodies hold exceptions and rationale.                              |
| R0009: Search and consolidate rules before adding a claim.                                   | tools/semvariant                                                                  | Halo R0056: retain a surviving ID, delete retired sources, and regenerate.                                            |
| R0010: Keep policy in rules, procedures in skills, and implementation facts at their source. | tools/semvariant                                                                  | Halo R0057: avoid parallel handbooks and claims that planned behavior already exists.                                 |

The broad UI scopes above contain some non-UI files. The rule's trigger remains “changing application UI”; retrieval does not require using Maui for route parsing or server-only work.

## Preserve the authored root guide deliberately

The first generation attempt refused to overwrite the authored root AGENTS.md and left it byte-identical. The migration then verified that R0002 and R0003 contained both original sections verbatim after whitespace normalization, deliberately removed the authored guide, and generated its replacement. The generator's collision protection was not weakened.

The generated root is now a short index. This abbreviated before/after preview omits the rest of the generated prelude:

```diff
-# Agent notes
-## Releasing
-## Running the viewer from a checkout
+# Diffmap repository guidance
+Read applicable rule bodies with npm run semvariant -- context <paths> --full.
+- R0002: Release product-doc through a separate version commit and staged npm approval.
+- R0003: Use the source viewer when developing from a checkout.
```

The release and checkout details moved into full rule bodies; they were not deleted. [[AGENTS.md]] contains the full generated prelude explaining lookup, inheritance, and generation.

Scoped guides inherit that root prelude rather than repeating it. For example, [[src/github/AGENTS.md]] contains its generated-file notice, directory heading, and local rule title; root lookup instructions and root rules still apply. Generation and retrieval use the same scopes as before.

## Where validation runs

There is no separate Semvariant GitHub workflow. Halo's current package scripts run semvariant validation first, then typecheck, lint, formatting, and unit tests through Turbo's affected-package selection; `check-affected` aliases `check`. [[package.json]] adapts that structure to npm: `npm run check` runs semvariant validation first, then typecheck, lint, formatting, and the existing `npm test` suite. `npm run check-affected` aliases it, and `prepublishOnly` reuses it.

Diffmap is one package, not a Turbo workspace. Both command names check the whole package, including the viewer/library builds that `npm test` already requires. No package graph, cache, new dependency, or file-level test selector is introduced.

The semvariant portion:

- Validate canonical rule structure and ensure generated `AGENTS.md` indexes match their rules. Drift fails; checks do not regenerate or commit files.
- Typecheck, lint, and format-check the semvariant tool.
- Run its seven real-CLI regression tests, including scope selection, collision safety, and drift repair.

Running either command validates and builds test prerequisites: it does not launch review agents, verify that code obeys every prose rule, publish a package, or deploy anything. There is no new automatic PR check or affected-file selection within this single package.

## What happens to Halo's 64 rules

| Halo rule IDs                           | Decision for diffmap                                                                                                                                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0001, R0011, R0052, R0054–R0057        | Port the retrieval, document-location, UI-skill, and authoring ideas with local scopes and existing skill links.                                                                                                                                   |
| R0002–R0004, R0007                      | Do not import triggers for absent errore, review, logos, or comparison skills. A local retrieval skill is enough; reviewers receive the same full-rule lookup.                                                                                     |
| R0005, R0006, R0010, R0012–R0014, R0025 | Do not copy Halo's prose, command inventories, summary format, temporary-work paths, desktop validation, or host setup. Existing diffmap skills, scripts, and execution guidance own those workflows.                                              |
| R0008, R0009, R0015–R0024, R0049        | Omit Halo release promotion, hidden test reports, Entire/Brain/private checkpoint tooling, cloud setup, hosted-agent policies, and distributed deployment order. Preserve diffmap's staged npm release instead.                                    |
| R0026–R0036, R0046–R0048, R0060, R0062  | Do not impose Halo's workspace packages, mandatory service classes, streams, SerialQueue, host capabilities, constructor style, or architecture. This port does not refactor diffmap.                                                              |
| R0037, R0038                            | Retain diffmap's strict TypeScript, existing errore usage, and existing null lint check. Do not import an absent errore skill or broaden this into an error-handling rewrite.                                                                      |
| R0039–R0045                             | Keep diffmap's node:test/tsx tests and public-behavior assertions. Do not import Vitest/Playwright fixture mandates or a temporary-test coverage gate. Prove the tool through CLI behavior.                                                        |
| R0050, R0051, R0063                     | Do not add duplicate generic engineering guidance; these are not required to operate semvariant.                                                                                                                                                   |
| R0053                                   | Omit the Turso-specific rule; diffmap has no Turso package.                                                                                                                                                                                        |
| R0058, R0059, R0061, R0064              | Do not impose no-index, wildcard-export, import-extension, naming, or unreleased-product compatibility mandates. Diffmap already publishes [[src/index.ts]] and [[src/preview/index.ts]], uses its own import conventions, and has released users. |

This mapping accounts for all 64 source IDs. It is intentionally not 64 new diffmap rules. The approved ten-rule scope did not silently adopt Halo's other policies.

## Skills and reviewer behavior

The local [[.agents/skills/retrieving-semvariant/SKILL.md]] owns lookup and maintenance, with npm examples and collision recovery. It was reloaded into the current session successfully. Productdoc, Maui, and repository-management procedures remain in their existing skills.

R0001 tells reviewers to read full rules and cite the local ID, canonical rule path, and violating code. The existing repository-management skill now retrieves full rules before preparing or reviewing a diff. No Halo P0/P1 classifications or hosted reviewer configuration were imported.

## Verification

The proof compared the old root guidance with the new bodies and checked every canonical-rule skill link. Exact retrieved IDs matched independent expectations for a viewer file (five rules), parser file (four), spec page (five), and tool file (eight). The seven UI directory guides each contain the single UI rule in addition to inherited root guidance. [Phase 3](03-checks-and-proof.md#observed-proof) links the captured outputs.

The root-only prelude regression [failed before the generator change](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/scoped-guide-before.log), then the complete [semvariant check passed all seven tests](/__diffmap/media?path=../../../.amp/in/artifacts/semvariant/scoped-guide-after.log). Regeneration updated nine scoped guides without changing the root; a second generation reported all guides up to date. Full lookup for `src/github/route.ts` still retrieved all four root rules plus its scoped UI rule.

```changes
57d89e32042370d9b305264668a59155633def57
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
tools/semvariant/semvariant.ts
tools/semvariant/semvariant.test.ts
tools/semvariant/cli.ts
tools/semvariant/tsconfig.json
tools/semvariant/NOTICE
package.json
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
