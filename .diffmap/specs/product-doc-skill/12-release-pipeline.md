# ⏳ Prepare npm release setup

[Packaging](08-product-package.md) supplies the candidate. The local release target is now the unscoped **product-doc** package, not `@tanishqkancharla/product-doc`. This page separates safe local preparation from the first authenticated operation that claims the npm name.

## What is ready locally

The manifest, lockfile, CLI updater, guide, skill stub, README and workflow guard agree on `product-doc`. `npm run release` now stages rather than publishing directly. The workflow still stages only from main using GitHub OIDC, includes provenance, and requires maintainer approval on npm before a version goes live. Its error handling no longer treats any generic “Cannot stage” failure as successful staging.

The repository pins npm 11.15.0, the minimum for staged publishing. CI uses Node 24 and upgrades npm when required. The CLI itself still supports Node >=22; release tooling separately needs Node >=22.14.0 and npm >=11.15.0. This orb has Node 26.12.1 and system npm 11.5.1; release commands use npm 11.15.0 through npm exec. After explicit user approval and sign-in, the first candidate `product-doc@0.13.1` was staged on November 14, 2026. npm now publicly lists the `0.0.0-stage` placeholder under `tanishqkancharla`; the actual candidate is not approved or live. See [the staging record](14-runtime-release.md).

Illustrative release gate, not a new API:

```tsx
const candidate = verifyLocalTarball("product-doc");
if (approvedToClaimName && authenticatedMaintainer) {
  stage(candidate); // first stage also creates a public placeholder
}
// A maintainer's later 2FA approval makes the actual version public.
```

## Name availability is not ownership

The pre-stage lookup returned E404, which alone did not establish ownership. The subsequent authenticated first stage succeeded: the public registry now lists `product-doc@0.0.0-stage` maintained by `tanishqkancharla`, and the staging record identifies the same actor for 0.13.1. That operation, not the lookup or manifest edit, claimed the unscoped name.

## First-package bootstrap — needs approval and npm sign-in

npm requires a package to exist before adding a trusted publisher. Staging a new package creates a **public 0.0.0-stage placeholder** and a private staged candidate; the real version remains unavailable until approval. Therefore even the first stage changes public registry state and must be explicitly approved.

1. Choose the candidate version before staging. Current 0.13.1 is inherited from the checkout, not an approved version decision. Complete the clean onboarding check before approving a staged candidate as the public release. Make any release-version bump in its own release commit, as [[AGENTS.md]] requires.
2. With approval, sign in as the npm maintainer and use npm >=11.15.0 to stage the reviewed candidate. Do not use a dummy package or direct publish merely to reserve the name. Do not require provenance from a local non-CI bootstrap; CI stages include it.
3. After the placeholder exists, configure trusted publishing on npm for **product-doc**: GitHub user `tanishqkancharla`, repository `diffmap`, workflow filename `publish.yml`, no environment. Allow stage publishing only, not direct publishing or dist-tag management.
4. Coordinate configuration with the first trusted release: npm says a new trusted publisher must complete its first successful publish within **two days** or it expires. Do not configure it weeks before launch.
5. Review/download the staged candidate, inspect its contents, and approve with 2FA only when ready to publish. After bootstrap, verify a subsequent CI stage uses the intended trusted identity. Do not restage the same already-staged version expecting a fresh OIDC validation; the workflow intentionally skips duplicates.

The bootstrap stage may be approved as the first release; a later version can exercise the established CI route. Rejecting a stage or recovering from an expired trust relationship is a separate maintainer action, not permission to unpublish or overwrite a released version. An existing package/version cannot be reused by changing its contents.

## Release push and recovery boundary

The workflow runs on a push to main; it is not a harmless CI-only check. After setup, a release push can stage an unpublished version. It cannot make the candidate live without maintainer approval. If npm authentication, trust, provenance, or network access fails, stop and fix that error rather than reporting staging as success. Known duplicate-version conflicts remain no-ops; unknown conflicts fail.

If first-name staging is rejected or someone else claims the name, stop and choose a new target before publishing. Do not silently fall back to the scoped package. If trust expires, review and recreate the connection with approval; do not add a permanent publish token as a workaround.

## Review priority and verification

**Important:** [[.github/workflows/publish.yml]], [[package.json]], [[src/update.ts]], [[src/update.test.ts]], and [[skills/generate-product-doc/SKILL.md]]. **Supporting:** [[package-lock.json]] mirrors root metadata; [[README.md]] and [[guide.md]] update the advertised commands. Keep behavior tests visible when summarizing the eventual commit.

Executed checks: all 70 tests pass; typecheck, lint, formatting, and 17-page validation pass. npm 11.15.0 was acquired through temporary npm exec and its stage help verified, without invoking a stage. Packing succeeded with that version. The actual workflow scripts passed syntax checks, the wrong-package guard rejected the legacy name, and simulated staging success/duplicate/authentication/conflict/network cases produced the expected exit status. Those local checks performed no registry writes. The later user-approved first stage claimed the npm name and its downloaded tarball matches the tested checksum; [the staging record](14-runtime-release.md) separates that actual operation from these earlier checks. npm trust configuration, staged approval, and real GitHub OIDC remain unverified. Reading trust settings requested an additional 2FA challenge; no settings were changed.

Official references checked November 14, 2026: [unscoped public packages](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages), [staged publishing](https://docs.npmjs.com/staged-publishing), [trusted publishing](https://docs.npmjs.com/trusted-publishers), and [npm trust prerequisites](https://docs.npmjs.com/cli/commands/npm-trust). These are release procedures, not authoring instructions added to the skill stub.

Feeds [runtime publication](14-runtime-release.md). Existing Diffmap packages, the legacy skill, website, DNS and PostHog configuration are untouched.

```changes

```
