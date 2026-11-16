# Finish the skill and user migration

[The runtime release](14-runtime-release.md) makes productdoc publicly installable. This phase turns the temporary two-skill period into a clear successor path; it does not establish two permanent products.

## Today

`generate-product-doc` is a short stub whose primary command is `npx product-doc guide`. The local stub no longer falls back to an older guide; public onboarding stays gated while the new package is unavailable. Authoring instructions live in the CLI's [[guide.md]], not the stub. `generate-diffmap` remains present during transition.

## Proposed

After public runtime verification, test the successor stub against the advertised package and Git skill source. Finalize install, update, and removal instructions for productdoc. Ask existing Diffmap users to migrate to `generate-product-doc`, keeping their documents and source links. Give them a tested command sequence and recovery path.

Choose the notice/deprecation timing explicitly. Do not delete the old skill, deprecate the npm package, redirect domains, or alter an old published updater merely because this plan exists. Any old-skill pointer should be small and point forward, not retain a second authoring manual.

## Acceptance

Preview the real instruction diff. Install the successor from the advertised public Git source in Amp and acquire the released runtime without a local symlink or preinstalled checkout. Verify a new document and an existing document, the guide, title, comments, and update identity. Confirm users can migrate without copying or losing documents. Keep the website CTA gated if public installation fails.

Feeds [website rollout](16-website-rollout.md).

```changes

```
