# ⏳ Fixed 0.13.2 candidate staged; release not approved

## Current fixed candidate

After explicit approval to stage the fix without releasing it, **product-doc@0.13.2** was staged on November 14, 2026, at **01:36:49 UTC**. It includes the first-repository fix. No approval command was run; public npm versions still contain only `0.0.0-stage`.

- Stage ID: `c0c81281-1983-4c16-b11e-92f393bc9713`.
- Actor: `tanishqkancharla`; access public; intended tag `latest` after approval.
- Last checked status: **validating**.
- SHA-1: `5595d954060f997cb4ccef19f729bfbd9676383f`.
- Downloaded stage is **byte-for-byte identical** to the locally tested tarball, not merely inferred from source.

The 0.13.2 build passed all **71 tests**, typecheck, lint, formatting and diff checks. An isolated install of the exact tarball verified its version, guide equality, document validation, and correct staged/working/unstaged/all contents without a first commit. The earlier browser onboarding rerun verified the same fix before this version-only bump.

The version bump is local and uncommitted. Before landing a release, keep the version bump in its own `Release 0.13.2` commit as repository guidance requires. No commit, push, CI trigger, trust-setting change, publication, or deployment occurred in this staging step. The older 0.13.1 stage was neither approved nor rejected; it still lacks the fix.

**Next release action requires separate approval.** Do not approve the older stage. Confirm npm validation completes before approving the exact new stage. Public package/skill acquisition still needs its check after publication.

## Historical first-name stage: 0.13.1

[Release setup](12-release-pipeline.md) prepared stage-only publishing for the unscoped `product-doc` package. The user then explicitly approved npm sign-in and the first stage of **product-doc@0.13.1**, without approval to make that version live.

## Actual delivery state

**The name is claimed; the runtime is not live.** npm now publicly lists only its `0.0.0-stage` placeholder, maintained by `tanishqkancharla`. The real 0.13.1 candidate is in the authenticated staging area. The November 14 onboarding recheck reports status **staged**, not approved. Do not enable public-install CTAs or tell users that `npx product-doc` works yet.

Illustrative state, not a new API:

```tsx
const publicVersions = ["0.0.0-stage"];
const candidate = {
  package: "product-doc",
  version: "0.13.1",
  status: "staged",
};
const releaseApproved = false;
```

## Executed operation and evidence

npm confirmed the signed-in account was `tanishqkancharla`. A fresh registry lookup still returned E404 before staging. npm 11.15.0 then successfully ran `npm stage publish --access public` from the tested checkout, with telemetry disabled and without local provenance claims.

The authenticated staging record identifies:

- Package/version: **product-doc@0.13.1**, tag `latest`.
- Stage ID: `e9e75cc6-ecdd-43d0-a460-4f51591bfe24`.
- Created: **November 14, 2026, 00:31:34 UTC**.
- Actor: **tanishqkancharla**, actor type `user`.
- SHA-1: `d8dd9eb60934250df5579c7621bdc1acf41849df`.
- Last checked status: **staged**.

The staged tarball was downloaded through npm and its SHA-1 matches both the staging record and the exact unscoped tarball previously installed and smoke-tested. Its contents are not inferred from current source files. Public registry `versions` contains only `0.0.0-stage`, confirming 0.13.1 was not released by this operation.

## Not done

No `npm stage approve`, direct publish, trust configuration, CI trigger, code push, website rollout, npm deprecation, or legacy package change occurred. Local code remains uncommitted and unpushed. Local document status updates after staging are not part of the immutable staged artifact.

An attempted read of npm trust settings required an additional 2FA challenge; it did not reveal the settings or change them. Do not infer that a trusted publisher is configured from successful interactive staging. No extra 2FA action is needed merely to finish recording this stage.

## Remaining release gates

The initial 0.13.1 stage completed validation but still contains the missing-HEAD failure. The [minimal onboarding trial and rerun](13-clean-onboarding.md) verified the local fix; the separately approved 0.13.2 stage above now includes it. Keep the stages distinct: neither tracks later local edits. Fresh-agent selection and post-publication acquisition remain separate checks.

Configuring a **stage-only** trusted publisher for GitHub repository `tanishqkancharla/diffmap`, workflow `publish.yml`, no environment, is a separate shared-settings action requiring explicit approval and likely 2FA. Coordinate its first successful trusted publish within npm's two-day validation window. Do not grant direct-publish or dist-tag permissions.

Any future release approval should target the fixed **0.13.2** stage after npm validation, not the historical 0.13.1 stage. Approval has not been requested or performed. Once separately approved, verify registry availability and a clean public install before unblocking [skill migration](15-skill-cutover.md) and website CTAs. A placeholder or staged version is not a usable public runtime.

```changes

```
