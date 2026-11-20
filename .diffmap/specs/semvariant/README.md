# Semvariant: repository rules you can find and trust

When an agent changes the viewer, it should find the viewer's rules without reading a handbook for every part of the repository. When a reviewer cites a rule, both people should be able to retrieve the same claim and its exceptions. Semvariant makes that possible with scoped, numbered Markdown rules and generated guidance indexes.

**Status: implemented; shipping authorized.** The rule engine, ten canonical rules, ten generated guidance indexes, retrieval skill, and aggregate repository check are committed together in [57d89e3](https://github.com/tanishqkancharla/diffmap/commit/57d89e32042370d9b305264668a59155633def57). The three phase pages describe parts of that atomic implementation commit, not separate commits. The executable proof passed, including deliberately broken inputs and recovery. The requester authorized committing all work, rebasing onto `origin/main`, running the full suite, and pushing. The shipping result is recorded in the thread; no package release or manual deployment is part of this change.

## What Halo built

At [Halo commit 536cffe3](https://github.com/cashew-labs/halo/commit/536cffe316681229cbb4b76984dfe98299572672), 64 rule files replaced a conventions handbook and scattered guidance. Each file has a stable ID, a complete claim as its title, a body explaining the judgment, and a list of directories where it applies. A CLI generates each directory's AGENTS.md as a short title index and retrieves the full rules for selected paths.

The name does **not** mean semantic versioning. Semvariant checks that rules are well formed and their indexes match. It does not prove that an implementation obeys the prose. Agents and reviewers judge that after reading the full rule. Oxlint and tests remain separate executable checks.

```html
<div
  style="display:grid;gap:12px;padding:20px;border:1px solid #aaa;border-radius:12px;font:15px system-ui;line-height:1.5"
>
  <strong>One rule source, two ways to read it</strong>
  <div style="padding:12px;border:1px solid #aaa;border-radius:8px">
    Author a numbered rule → choose the directories it governs
  </div>
  <div style="padding:12px;border:1px solid #aaa;border-radius:8px">
    Generate → small AGENTS.md indexes where agents encounter them
  </div>
  <div style="padding:12px;border:1px solid #aaa;border-radius:8px">
    Select changed paths → retrieve applicable titles and full bodies
  </div>
  <div style="padding:12px;border:1px solid #aaa;border-radius:8px">
    Check → reject malformed rules or stale indexes; reviewers judge the code
  </div>
</div>
```

## What changes for diffmap

An agent editing a viewer component would ask for context for that file. It would receive repository-wide rules plus viewer-specific rules, but not the rules for authoring the semvariant tool. The agent reads full bodies before editing; a reviewer uses the same lookup before citing a violation.

Illustrative behavior, not an available API:

```ts
const rules = context(["src/viewer/ViewerApp.tsx"]);
// Root guidance + viewer guidance, each rule included once.
const fullRules = show(rules.map((rule) => rule.id));
// Read the rationale and exceptions before judging the change.
```

We port Halo's mechanism and authoring discipline, not its Electron monorepo, infrastructure, private memory tooling, or every coding preference. Diffmap remains an npm package with CLI, viewer, preview integration, and hosted routes. Its package is now named product-doc; its repository and existing spec directory remain diffmap.

## Implemented scope

1. [Port the local rule engine](01-rule-engine.md): the same retrieval, inheritance, generation, and safety contract, using npm and this repository's TypeScript tools.
2. [Map rules onto diffmap](02-diffmap-rules.md): preserve existing release and checkout guidance; scope UI and rule-authoring guidance; keep procedures in their existing skills and guides.
3. [Connect checks and prove the contract](03-checks-and-proof.md): aggregate local validation, reviewer retrieval, and controlled failures that demonstrate the checks actually reject mistakes.

**Non-goals:** adding a public product-doc command, publishing a semvariant package, refactoring product architecture, renaming public entry points, changing test frameworks, importing Halo's anti-slop lint suite, configuring hosted review agents, changing branch protection, or releasing a package.

## Proof and delivery state

The approved scope ports the mechanism rather than imposing Halo's architecture and coding preferences. Existing release and checkout instructions survive verbatim after whitespace normalization in R0002 and R0003. Source attribution, Apache-2.0 license, and applicable notices accompany the copied tool.

`npm run semvariant:check` passed all seven CLI tests on Node 22, 24, and 26; the existing product suite passed all 97 tests after correcting fixture environment settings. Typecheck, lint, and repository formatting passed. A package dry run confirms the 482-file candidate package excludes the tool, rules, skills, and generated guides while retaining the product CLI and viewer.

The decisive control was not just a green run: the same integration command exited 1 after a generated guide was deliberately corrupted, then exited 0 after generation restored it. A separate copied-engine mutation that dropped viewer-specific rules made the regression test fail. [Phase 3](03-checks-and-proof.md#observed-proof) links the captured evidence and explains setup corrections and limits.

There is no separate Semvariant GitHub workflow. Following Halo's structure, `npm run check` runs semvariant validation first, then typecheck, lint, formatting, and product tests; `npm run check-affected` aliases it, and `prepublishOnly` reuses it. This single-package repository checks the whole package without introducing Turbo. No live-agent obedience evaluation was run, and no automatic enforcement of prose is claimed.

## References

- [Halo implementation and rule files at the requested commit](https://github.com/cashew-labs/halo/tree/536cffe316681229cbb4b76984dfe98299572672/tools/semvariant).
- [Halo semvariant design notes](https://github.com/cashew-labs/halo/blob/536cffe316681229cbb4b76984dfe98299572672/.diffmap/semvariant.md), [retrieval skill](https://github.com/cashew-labs/halo/blob/536cffe316681229cbb4b76984dfe98299572672/.agents/skills/semvariant/SKILL.md), and [review guidance](https://github.com/cashew-labs/halo/blob/536cffe316681229cbb4b76984dfe98299572672/.agents/skills/code-review/SKILL.md).
- Diffmap's existing guidance: [[AGENTS.md]], [[.agents/skills/generate-product-doc/SKILL.md]], and [[.agents/skills/managing-diffmap-repo/SKILL.md]].
- Current executable contracts: [[package.json]], [[tsconfig.json]], [[.oxlintrc.json]], [[.oxfmtrc.json]], [[src/index.ts]], and [[.github/workflows/publish.yml]].
