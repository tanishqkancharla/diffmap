# Phase 4: Send comments to the pull request

[Phase 2](03-sign-in-with-github.md) signed the reader in, and [Phase 3](04-private-repos.md) added the proxy that calls GitHub as them. This phase lets a reviewer post their diffmap comments to the pull request as one GitHub review, so the author reads them where they already work and other reviewers see them.

**Today**

Comments live in the reader's `localStorage`, one key per page ([[src/viewer/comments.ts#commentsKey]]). **Copy comments** ([[src/viewer/CopyCommentsButton.tsx#CopyCommentsButton]]) copies every page's comments as a numbered Markdown list ([[src/viewer/comments.ts#formatComments]]), which the reader pastes into GitHub or an agent by hand.

**Proposed**

On a pull request's spec, a signed-in reader sees **Send review** beside **Copy comments**. It opens a small dialog with the review's summary box, and **Comment**, **Approve**, and **Request changes**, as on GitHub. Sending posts one review on the pull request and shows a link to it. Their comments stay in diffmap afterwards, marked sent, so sending twice does not post duplicates. On a commit spec or a gist there is no pull request, so only **Copy comments** shows.

## Where each comment goes

GitHub reviews take two kinds of comment: line comments on the pull request's diff, and the review's body. A diffmap comment becomes a line comment when GitHub can place it, and goes in the body otherwise.

| diffmap comment | In the review |
| --- | --- |
| Lines in the Diff panel on a file the pull request changes | Line comment: `path`, `line`, `start_line`, and `side` from the `LinesAnchor` |
| Lines in a file excerpt or an in-page diff | Line comment if the lines fall in the pull request's diff, else the body, with the lines quoted |
| Highlighted prose, a diagram, or a gallery label | The body, quoting the highlight, with a link to the spec page and heading |

The body opens with the reviewer's summary, then lists the body comments in the order **Copy comments** uses, so it reads the same as the pasted list does today.

```ts [The request the proxy forwards]
POST /repos/{owner}/{repo}/pulls/{n}/reviews
{
  commit_id: pinnedSha,
  event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES",
  body: summary + bodyComments,
  comments: [{ path, line, start_line, side, body }],
}
// [!note pinnedSha] The SHA the page was pinned to at load. If the pull request moved on since, GitHub keeps the comments and marks them outdated, as it does for its own reviews.
```

If GitHub rejects a line comment because the line is not in the diff, the viewer moves it to the body and sends again, rather than failing the review.

## What stays local

Reviewed checkboxes stay in `localStorage`. GitHub's "Viewed" checkbox on a file has no public API, and a database for them is option C's larger form in [What cloud could mean](01-what-cloud-could-mean.md#c-shared-review-state-across-reviewers).

```changes

```
