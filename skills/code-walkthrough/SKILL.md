---
name: code-walkthrough
description: Explain implemented code or changes with a plain-language, explorable tkstack walkthrough, linked detail diagrams, and source evidence. Supports focused diffs and large or whole-project changes.
---

# Explain how the implemented system works

Start from what the reader is trying to understand. Describe behavior before naming internal symbols. Use the real code to verify explanations, but do not require the reader to read code to learn what a step means.

## Choose the right scope

Inspect repository instructions, `git status`, the requested diff/range, and entry points. Include staged, unstaged, and requested untracked files. If commits exist, use them; do not infer that the whole project is new merely because it is unfamiliar. Record the input version and explain what was excluded.

For a focused change, show the previous behavior, the new behavior, and why it matters. For a large diff, an initial implementation, or a request to understand the project, first map the whole current system. Group it by user outcomes or execution stages, then attach the relevant changes to those groups. Do not dump one enormous diff, list every file, or force every function into a call stack. Keep overall architecture and actual changed behavior distinct.

Use calldiff if available and useful for the language. It is optional. Verify calls, branching, asynchronous work, and ownership in the source; static relationships are not runtime evidence. Do not invent old behavior or diff markers.

## Write for the reader

Match the reader’s familiarity with the project. Prefer behavior labels such as “Check each uploaded row” over internal names such as “Schema reconciliation.” Define necessary domain terms on first use and distinguish components with similar names by what they do. Keep exact symbol names available as source evidence.

Keep the main page a short guided route. Put details behind clicks without dropping important rules: inputs, outputs, decision conditions, failure paths, and data access boundaries where relevant. Include a small numerical or concrete example when it clarifies a rule, and label invented example values as illustrative. Distinguish intended behavior, behavior verified in source, and results actually observed by running the system.

## Make the diagrams explorable

Prefer a small overview with drill-down diagrams. Each important node AND arrow should open an explanation. For an arrow, explain what is sent, why the receiving component needs it, what comes back, and how that affects the next step. Labels must make sense without opening the code.

Use `%% ref node:ID ... [[explain:detail-id]]` or `%% ref edge:0 ... [[explain:detail-id]]` inside a Mermaid fence. Edge indices are zero-based declaration order, including self messages. Every declared reference must target a real element. The same detail links work on callstack rows. Nested diagrams can link to other details; the viewer provides Back navigation.

Define a detail in a hidden `explain:detail-id` JSON fence. The first definition is the initial right-side explanation. The viewer shows Explanation, Diagram, and Code tabs; Explanation can also include the nested diagram.

Read [the explanation format](references/explanations.md) when authoring linked details. It documents the JSON fields, nested diagram links, source references, and a small example. For a runnable whole-project overview, see [tkstack’s own walkthrough](../../fixtures/exploration.md).

Use annotated call stacks when function ownership is useful; they are an optional deeper view for a whole-project tour. Keep sibling calls siblings and mark conditional alternatives. Put exact names in source links or the Code view; use plain descriptions in the reader's main path.

## Source and diff evidence

Current source links use `[[path#Symbol]]`, `[[path#Class.method]]`, or `[[path#L12-L30]]`. Python, TypeScript and JavaScript support symbol references and Cmd/Ctrl-click definition navigation. Python uses Pyright; dynamic calls and missing dependencies may be unresolved. Do not silently substitute a same-named function. Old diff lines that no longer match the workspace cannot be resolved against current source.

To show a change, embed the real unified patch in `source-diff:id:path` and link `[[id:old:12-20]]` or `[[id:new:12-20]]`. Each range must fit a hunk. Use the same Git comparison throughout. For a new file, `git diff --no-index -- /dev/null path` yields a real patch (exit 1 means differences). Preserve unchanged context where needed. Detail `sources` may refer to these patches too.

## Produce and verify

Write `tmp/code-walkthrough-<name>/walkthrough.md` under the repository. Serve it with the installed tkstack CLI, e.g. `node /path/to/tkstack/bin.js <walkthrough> --root <analyzed-source-root> --port 4177`. Keep any isolated source snapshot with its matching walkthrough; include only the source needed to explain the implementation.

Verify document parsing, all detail references, diagram targets, and source ranges. For viewer changes, exercise a node, an arrow label, a nested diagram, Back, and Code; test the relevant language's definition navigation. Check the actual viewport for readable diagrams. Reorient or split a diagram when fitting it to a column makes its labels too small; zoom is a fallback, not a substitute for a readable overview. State checks performed and gaps, without claiming unperformed runtime checks.

Review as an unfamiliar reader: can they predict what this component will do from the explanation and diagram alone? Does each unfamiliar term have an accessible explanation? Can they follow a decision to its evidence? If not, revise the walkthrough before delivering it.

Report the saved path and working local URL. When the user asks to see it, open the viewer and keep the tab available.
