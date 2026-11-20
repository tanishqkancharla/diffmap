---
name: retrieving-semvariant
description: Retrieves and maintains directory-scoped repository rules. Use when applying, reviewing, editing, consolidating, or retiring diffmap guidance.
---

# Retrieving semvariant rules

<!-- Adapted from Halo 536cffe316681229cbb4b76984dfe98299572672, Apache-2.0. See tools/semvariant/NOTICE and LICENSE. Modified commands and paths for diffmap. -->

From the repository root, run `npm run semvariant -- context <paths> --full` for the files you will change. For a review, select `--staged` or `--diff <rev>` instead of explicit paths. Context selects each path's directory and ancestors, not all descendants; explicitly select untracked paths or stage them.

Use `npm run semvariant -- show <IDs>` to retrieve selected bodies and `npm run semvariant -- search <terms>` to find rules; search matches any supplied substring, case-insensitively. Read full bodies before applying rules or judging violations. Titles alone omit rationale and exceptions.

When changing guidance, include `tools/semvariant` in context to retrieve rule-authoring guidance. Search for the existing owner before adding a claim. Edit canonical rules, then run `npm run semvariant -- generate` and `npm run semvariant:check`.

Retrieval rejects malformed rules and stale projections. Inspect reported files and generate to repair drift. An authored `AGENTS.md` collision needs deliberate migration before replacement; the generator will not overwrite it. `npm run semvariant -- help` lists commands.
