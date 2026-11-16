# ⏳ Add the productdoc skill stub and CLI guide

The [overview](README.md) establishes productdoc as the standalone successor to Diffmap. This local change adds `generate-product-doc` as a short guide-loading stub, aligned agent metadata, and local discovery. Authoring guidance lives in the CLI, not a second manual in the skill. Not committed or released.

## Before

The initial local implementation put most product-level authoring instructions in the skill and treated it as a permanent parallel entry point. That was the wrong boundary and product model.

## Built locally

The stub's primary command is `npx product-doc guide`. It loads version-matched instructions, just like the existing skill pattern. A short migration note preserves existing documents; there is no fallback to a legacy guide with different instructions. Until publication, use the local checkout CLI for trials. The two skills coexist during transition; the successor is not an extension that requires a separately marketed Diffmap product.

[[guide.md]] now owns explaining existing systems, planning future work, and reviewing changes. It leads with reasoning, familiar actions/workflows or service responsibilities, then uses source code as evidence. Plans require one small independent or commit-sized change per page; explanations need no invented implementation phases. The guide covers diagrams, call-stack diffs, media inspection, prose previews, title handling, and honest proposal/release boundaries alongside the existing syntax reference.

Illustrative flow, not an additional API:

```tsx
const guide = cli.run("guide");
const document = authorFromGuide(readerQuestion, inspectedEvidence, guide);
```

## Preview the actual stub

The excerpt is loaded from the real local source:

```1:17:skills/generate-product-doc/SKILL.md

```

[[skills/generate-product-doc/agents/openai.yaml]] points at the same three intents and delegates to the guide. `.agents/skills/generate-product-doc` remains a symlink to this source, not a duplicate file.

## Check the boundary

The `product-doc guide prints guide.md` test passes against the compiled entry point, confirming the CLI returns the guide verbatim. The full suite passes all 70 tests; typecheck and lint pass. The installed tarball also returns its bundled guide without a TypeScript loader. Skill reload reports no errors. This remains a short stub rather than the former 5,040-byte manual.

A fresh-agent compliance/triggering evaluation is separate and has not been run. The new package command remains a release target, not an already published artifact.

The [next page](02-discover-product-docs.md) previews README discovery and migration copy.

```changes

```
