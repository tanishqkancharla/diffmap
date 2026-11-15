# Phase 3: Private repos and no rate limit

[Phase 2](03-sign-in-with-github.md) gave a signed-in reader a session cookie that holds their GitHub token. This phase uses it to load specs from private repos, at the same URLs as public ones.

**Today**

[[src/github/fetchRepo.ts#githubFetch]] calls `api.github.com` from the browser with no token. A private repo answers 404, and a busy network runs out of its 60 requests an hour. Pages, excerpts, and media load from `raw.githubusercontent.com`, which has no rate limit but serves only public repos.

**Proposed**

A signed-in reader opens `https://diffmap.dev/<owner>/<repo>/pull/<n>/.diffmap/specs/<name>` on a private repo and sees the spec, with its diffs, source references, and screenshots, as for a public repo. An anonymous reader of a private repo sees the not-found page with **Sign in with GitHub**. Public repos keep loading straight from GitHub when nobody is signed in.

## The proxy

`api/github/[...path]` forwards a request to GitHub with the reader's token and returns GitHub's answer unchanged, status and rate-limit headers included, so [[src/host/githubFailure.ts#responseFailure]] keeps explaining failures as it does today.

```mermaid diff [Signed-in requests go through the proxy]
flowchart LR
    V[Hosted viewer] --> F{Signed in?}
    F -->|no| G[api.github.com and raw.githubusercontent.com]
+   F -->|yes| P[api/github proxy]
+   P -->|reader's token| G2[api.github.com]
    %% ref node:V [[src/github/GitHubApp.tsx#GitHubApp]]
```

The proxy only forwards what the viewer reads:

- `GET /repos/{owner}/{repo}/pulls/{n}`, `/commits/{sha}`, `/compare/{base}...{head}`, and `/contents/{path}?ref={sha}`.
- `GET /gists/{id}`, so secret gists of the reader's own load too.
- [Phase 4](05-send-comments-to-pull-request.md) adds one `POST`.

Anything else gets 404. The proxy refreshes an expired access token with the refresh token and sets the new cookie on its response.

## Raw files

`raw.githubusercontent.com` has no private equivalent that takes a token from a browser, so for a signed-in reader [[src/github/fetchRepo.ts#readSpecDirectory]] and [[src/github/fetchRepo.ts#fetchPinnedBlob]] read files through the contents API with `Accept: application/vnd.github.raw`. Media is the hard case: an `<img src>` cannot send the token. The proxy serves `api/github/repos/{owner}/{repo}/contents/{path}?ref={sha}` with the file's content type, and the viewer points private media at that URL, which carries the session cookie because it is on diffmap.dev.

Every one of these requests is pinned to a commit SHA, so the proxy marks its responses `Cache-Control: private, max-age=31536000, immutable` and the reader's browser never asks twice. A shared cache across readers is not safe without checking each reader's access, so it waits until there is a need.

## Rate limits

A signed-in reader gets GitHub's limit for app user tokens, 5,000 requests an hour each, instead of sharing 60 with their network. Public repos read by anonymous readers are unchanged.

```changes

```
