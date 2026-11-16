# ⏳ Minimal Amp onboarding: local rerun passes

The [packaged candidate](08-product-package.md) was tested on November 14, 2026, in an independent Git project created outside this checkout. This is a candidate-package and browser-workflow check, not proof of automatic skill selection or successful public npm acquisition.

## Result

**The requested local rerun passes, including the first-repository case.** The initial staged candidate exposed a missing-HEAD failure; the local fix and newly packed candidate now render change cards without creating a commit. Public package acquisition and fresh-agent automatic selection remain separate, unverified gates.

[Open the fixed installed-package trial](https://t-03h87b4dteyjvmjca16l3iwyh-p21879.onamp.dev/). The cover title is **Your first productdoc document**; the existing browser convention remains `page title · README title`. URL slugs are separate.

## Fixed-candidate rerun

After the user requested the fix, [[src/git.ts]] now resolves the uncommitted baseline to the existing commit or the already-used empty tree when no first commit exists. No commit is created. The index still determines staged content; working content includes later edits and untracked files.

```tsx
const base = headExists ? headCommit : emptyTree;
const changes = git.diff(base, selectedDestination);
```

The new regression in [[src/git.test.ts]] failed against the unchanged implementation with `fatal: ambiguous argument 'HEAD'`, then passed after the fix. It checks empty repositories and differing staged, unstaged, and untracked contents across `working`, `staged`, `unstaged`, and `all`. Existing committed-repository tests continue to pass. Full suite: **71 tests, 71 pass, 0 fail**; typecheck, lint and formatting also passed.

Built the viewer and library, then packed a **local-only product-doc@0.13.1** tarball with SHA-1 **736cadacdaa5057c37144320af75fcfa5858baea**. This is distinct from the immutable npm stage below. No version bump, new npm stage, publication, or approval occurred.

Created another independent Git project outside the checkout, installed that tarball and the local skill copy, and repeated Amp skill scanning, the exact stub command, guide equality, four-page validation, and preview serving. Staged the old trial README, edited it afterward, and kept the repository without commits, so staged and working contents differ rather than merely returning identical files.

- Original staged runtime: `GET /__diffmap/changes?rev=working` still returned **HTTP 400**.
- Fixed installed runtime: `working`, `staged`, `unstaged`, and `all` each returned **HTTP 200**. Assertions verified the old staged README, new working README, the unstaged old/new pair, added-file status, and untracked document inclusion. `all` matched working contents in this no-commit repository.
- Chromium inspection: the plan's Uncommitted card now lists files instead of an error; selecting README opens a populated diff panel. The explanation diagram, prose-review diff, call-stack diff, and README-derived titles still render. A text wait initially missed the diff's shadow DOM; a shadow-root content check and screenshot confirmed it rendered.
- Repeated pointer selection, comment save, Copy comments, actual clipboard paste/readback, and reload persistence with a new self-authored trial note. Applied it as a new paragraph saying this is a local candidate, not a public npm release; live reload showed the revision and the original comment remained attached.

The fixed trial is retained at `.amp/in/orb-backup/onboarding/fixed-project/` and served through its supervised portal. The older trial remains available for comparison; its known failure is not evidence against the newly packed candidate.

## Initial staged-candidate check

- Linux x64 orb; Node **26.12.1**, npm **11.5.1**, Amp **0.0.1794600035-g3776ae**. This does not verify Node 22 itself.
- Downloaded authenticated stage `e9e75cc6-ecdd-43d0-a460-4f51591bfe24`, package **product-doc@0.13.1**, using npm **11.15.0**. SHA-1 matched **d8dd9eb60934250df5579c7621bdc1acf41849df**. npm now reports the stage **staged**, not validating; public versions still contain only `0.0.0-stage`.
- Created `/home/user/workspace/productdoc-onboarding` with its own `git init`, no commits, no inherited project skill symlinks, no globally installed product-doc, and no source-checkout runtime. Global Amp skills remain available, including the legacy skill; this is not an empty Amp account.
- `npm install --no-audit --no-fund --ignore-scripts --save-dev ./product-doc-0.13.1-e9e75cc6-ecdd-43d0-a460-4f51591bfe24.tgz` succeeded, adding 87 packages.
- `amp skill add /home/user/workspace/repo/skills/generate-product-doc` installed a regular local `SKILL.md`, not a link. `amp skill list --json` reported `generate-product-doc` with source **workspace-agents** and the fresh project's base directory. The legacy global skill remained listed separately.
- With `DIFFMAP_TELEMETRY=0`, the exact stub command `npx product-doc guide` succeeded; `cmp` confirmed byte-for-byte equality with the installed candidate's `guide.md`.
- Authored a four-page document: cover; an existing-workflow explanation without a diff; one proposed Node-prerequisite edit; and review of an actual trial README edit. The plan is explicitly unimplemented, one small change per page. The review previews both the prose diff and readable result; an illustrative call-stack diff shows the changed reader expectation. `git diff --no-index README.before.md README.md` independently confirmed the actual text change.
- `npx --no-install product-doc validate .diffmap/specs/first-document --json` returned **valid: true** for all four pages. Serving used the installed prebuilt viewer, not Vite. `product-doc list --json` found it by its README title.
- Chromium at 1440 × 1000, DPR 2: inspected all three content pages, the responsibility diagram, proposed prose diff, actual prose diff, and call-stack diff. The plan page also visibly exposes the first-repo error described below.
- Selected text with the pointer, opened Comment, typed a trial note, saved with Ctrl-Enter, clicked Copy comments, and read back its actual Markdown. Direct clipboard reads lacked permission, so verification pasted into an unsaved editor and cancelled it. Reload retained the saved comment. Applied the copied trial feedback by changing “paste them into Amp” to “paste them into the same Amp conversation”; the running viewer reloaded that wording. This was a self-authored trial note, not an independent human usability study or an automated agent-notification test.
- Published legacy **@tanishqkancharla/diffmap@0.13.2** still returned its original guide using `npm exec --yes --package=@tanishqkancharla/diffmap -- diffmap guide`. That verifies legacy guide acquisition only, not a second complete legacy browser journey.

The trial project and downloaded candidate are retained under `.amp/in/orb-backup/onboarding/project/` so the review can continue. The supervised trial service serves that retained project on the same portal; the original external trial directory was removed after the check. No package approval, new stage, publication, push, deployment, or live telemetry was requested or performed.

## Initial failure, now fixed locally

The plan and review's empty `changes` cards render **“git diff failed”**, even though validation succeeds and the surrounding document renders. Confirmed on the unchanged installed candidate:

- `git rev-parse --verify HEAD` failed: the new repository has no first commit.
- `GET /__diffmap/changes?rev=working` returned **HTTP 400**, with `git diff failed in …`.
- The inspected source in [[src/git.ts]] resolves `working` to `HEAD` → worktree. `HEAD` does not exist in this case.

Focused pseudocode of the observed contract, not a fix already made:

```tsx
const base = "HEAD";
const result = git.diff(base, worktree);
// In a repository with no commits, HEAD is missing and the card fails.
```

**Fixed locally:** the empty-tree baseline and regression now cover this case, with the installed-package HTTP and browser checks recorded above. No user commit was created. The original npm stage is immutable and still contains the failure; the separately approved fixed 0.13.2 stage now supersedes it for release consideration.

The feedback revision also demonstrated an existing boundary: changing the highlighted wording can detach its old comment. The viewer labels it **Text not found** rather than reattaching it to unrelated text. The copied note still provided enough context to apply the revision.

## Minimal Amp quickstart and recovery

After a usable public release and the skill source are available, use Node.js 22 or newer, install the skill into the project, then ask Amp to use it. The public installation route is still pending; do not present the staged placeholder as a working package.

For the executed pre-release trial, install the downloaded candidate locally first, then install the local skill copy. The stub's plain `npx product-doc guide` will resolve the installed candidate. The maintainer-only stage download is not an account requirement for eventual end users.

- **Skill not listed:** from the project root, run `amp skill list --json`; verify the installed directory is `.agents/skills/generate-product-doc/`. Reload skills in the active Amp session after installation. Explicit loading can recover the workflow but does not prove automatic selection.
- **Node/npm missing:** install Node.js 22 or newer, then verify `node --version` and `npm --version`. This trial did not simulate missing Node.
- **Runtime unavailable:** before approval, use the candidate tarball; after release, test the public install separately. Do not fall back to an older Diffmap guide with a different authoring contract.
- **Invalid document:** run `product-doc validate <directory>` and use its diagnostic. Passing `README.md` instead of the directory was tested and correctly reported “a spec is a directory, not a file,” naming the directory to use.
- **Preview unreachable:** check `product-doc list`; in an orb expose the running service through its portal rather than sending localhost to the reader. Both trials used supervised services with telemetry disabled. The locally fixed candidate supports repositories with no first commit; the older npm stage still has the empty-card failure.
- **Feedback:** highlight text, Comment, then Copy comments and paste into the same Amp conversation. Notes are browser-local, not automatically delivered or shared with other readers.
- **Updates/removal:** the skill stub and CLI are separate installations. For this local trial, remove the dev dependency with `npm uninstall --save-dev product-doc`; remove only the trial's installed skill directory. Keep authored documents. Do not run the public updater against the placeholder. Public update/removal and the release quickstart still need their post-publication check.

## Not covered

No fresh-agent automatic-selection eval was run: the user asked to keep the work in this thread, and this session already knows the skill. Amp's scanner result is useful but narrower evidence. No GitHub skill install was tested because the new skill is unpushed. No public npm install, missing-Node simulation, remote gist share, multi-agent matrix, independent reader study, or minimum-Node run was performed. Sharing would publish external state and needs separate approval; the reachable portal is the review surface for this trial.

The local package/browser gate now passes. With explicit approval, a version-bumped **0.13.2** candidate containing the fix has now been staged and downloaded; it exactly matches the tested tarball. See [the current staging record](14-runtime-release.md). No release approval occurred. Keep fresh-agent automatic selection unverified until it is actually exercised. After publication, [skill cutover](15-skill-cutover.md) must repeat the quickstart using the actual public package and skill commands.

```changes

```
