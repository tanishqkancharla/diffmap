# ⏳ Make the successor skill discoverable

[The skill/guide phase](01-product-doc-skill.md) puts authoring instructions in the CLI. This page adds README discovery and migration copy. Implemented locally, not committed or pushed.

## Before

The README offers `generate-diffmap` for living specs and walkthroughs. Earlier local copy framed `generate-product-doc` as a permanent product-level alternative over Diffmap. That is not the intended product model.

## Built locally

The README now leads with productdoc and its broader scope, with productdoc.dev as the destination. It gates public installation explicitly while the renamed package is unpublished. The skill is a short pointer to the guide. Both skills coexist only during migration; the new npm package remains unreleased. The legacy Git repository path remains the current source, not a claim that the product must be used through Diffmap forever.

## Preview the actual wording

This excerpt comes from the local README, not an invented replacement or a released page:

```1:33:README.md

```

The ownership change in the local skill, compared with the previous implementation:

```diff
-# Product docs with Diffmap
-## Match the document to the question
+# Productdoc
+Before writing or updating a document, run this from the repository root and follow what it prints:
+npx product-doc guide
```

The removed authoring section now lives in [[guide.md]], alongside format and serving instructions. The snippet summarizes that real relocation, rather than implying the entire removed section was one line. The stub retains only CLI delegation, version recovery, and a short document-reuse migration note.

## Verification boundary

Check README/skill names and metadata together, reload the skill, and run the guide-output test. Validate the document and inspect this prose preview. The public Git installer and renamed npm target are not yet a verified public first-run flow; [the migration phase](15-skill-cutover.md) owns that release gate.

```changes

```
