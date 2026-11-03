---
name: managing-diffmap-repo
description: Writes pull requests, issue replies, and release notes for the diffmap repository, and runs its PR, screenshot, merge, and release workflow. Use when opening or describing a PR, replying to or closing an issue, or shipping a version of diffmap.
---

# Managing the diffmap repo

## Write for the person reading diffmaps

People read rendered diffmaps. Their agents write the Markdown, so the people who file issues and read PRs never see fence syntax, parser rules, or CLI output fields. Describe each change as they meet it:

- **What they see** in the viewer: a card, a panel, a message, a screenshot.
- **What their agent now does, or is told**: "your agent has to account for every file in a commit's summary, and diffmap warns it at startup when one is missing."

Leave out fence syntax, flags, field names, and source files. The diff, README, and `generate-diffmap` skill carry those for agents. This applies to everything user-facing: PR titles and descriptions, issue replies, and release notes.

For example, the reply that closed #34, about changed files missing from a spec, should have read:

> Thanks for the detailed report. The 24-file example made the gap easy to see. Starting in 0.9.0, your agent has to account for every file a commit changed in that phase's summary card: each one is either a file to review or one it marks as safe to skip. If it leaves a file out, diffmap warns it when the spec opens, so a change like your analytics event can't slip by unmentioned. Files it skips still fold away in the card, and a commit with nothing to review says "No file changes marked as important".

It should not have shown a `changes` fence with an `ignore:` line or the `warnings` output of `serve`.

## Pull requests

1. Branch from `main`. Commit the change, then bump the version in its own commit as `AGENTS.md` describes under Releasing (minor for new behavior, patch for fixes).
2. For anything a reader sees, capture the rendered diffmap. Serve a small spec that shows each affected state, then take element screenshots with `agent-browser screenshot '<selector>' <path>` at 2x scale.
3. Host the screenshots on the orphan `pr-assets` branch under `<issue or PR number>/`. The bot token cannot create gists, and the images must not land on `main`. Add them in a worktree checked out on `pr-assets`, push, and embed each image by its pinned commit URL, so later pushes never change it:

   ```html
   <img
     src="https://raw.githubusercontent.com/tanishqkancharla/diffmap/<pr-assets sha>/<n>/<file>.png"
     width="712"
     alt="What the image shows"
   />
   ```

   Never delete `pr-assets`; merged PRs embed images from it.

4. Write the description for the person reading diffmaps, as above: what changes for them, then screenshots, then the version it ships in. Put `Closes #<n>` on the first line.
5. Merge with `gh pr merge <n> --rebase --delete-branch` so the release commit stays separate on `main`. Vercel is the check that matters; Cursor Bugbot is optional and often slow.

## Issue replies

Thank the reporter for something specific in the report. Say what changed for them and the version it ships in. A merged version bump is staged on npm, not live, until a maintainer approves it, so write "will be in 0.9.0", not "is out in 0.9.0". Don't mention parts of the issue this release doesn't address.
