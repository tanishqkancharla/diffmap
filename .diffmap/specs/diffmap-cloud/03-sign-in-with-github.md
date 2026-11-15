# Phase 2: Sign in with GitHub

[Phase 1](02-untrusted-html.md) made sure no spec runs script on diffmap.dev. This phase lets a reader sign in with GitHub, so later phases can read private repos and write reviews as them.

**Today**

diffmap.dev has no idea who is reading. The header has no sign-in button, and every request to GitHub is anonymous.

**Proposed**

The hosted viewer's header gains **Sign in with GitHub**. It sends the reader to GitHub to approve the diffmap app, then back to the page they were on. Signed in, the header shows their avatar and a **Sign out** item. The local `serve` shows neither.

## The GitHub App

diffmap registers one GitHub App. It asks for:

| Permission | Access | Used by |
| --- | --- | --- |
| Metadata | Read | Every request |
| Contents | Read | [Phase 3](04-private-repos.md): pages, files, and media |
| Pull requests | Read and write | Phase 3 reads the head; [Phase 4](05-send-comments-to-pull-request.md) writes reviews |

An org installs the app on the repos it chooses. A signed-in reader's token works only where the app is installed and the reader already has access, so diffmap never sees more than the reader could open on GitHub. Public repos keep working without the app installed.

## The functions

Vercel deploys any file under `api/` as a function beside the static site, so diffmap.dev needs no other hosting. `vercel.json`'s rewrites only match the spec routes, so `/api/*` reaches the functions.

```services [Signing in]
service Viewer "diffmap.dev in the browser"
  state cookie = none
service Auth "api/auth functions"
service GitHub

start "A reader signs in"
  > The token never reaches the browser's JavaScript. It lives in an encrypted HttpOnly cookie that only the functions can read.

step "The reader clicks Sign in"
  Viewer -> Auth: GET /api/auth/login?return=/owner/repo/pull/12/...
  Auth -> GitHub: redirect to /login/oauth/authorize with a random state
    > The state is also set in a short-lived cookie, so the callback can check the request came from this sign-in.
step "GitHub sends the reader back with a code"
  GitHub -> Auth: GET /api/auth/callback?code&state
step "The function trades the code for tokens"
  Auth -> GitHub: POST /login/oauth/access_token with the client secret
  GitHub -> Auth: access token and refresh token
step "diffmap stores the session in a cookie"
  Auth -> Viewer: Set-Cookie diffmap_session, redirect to the return path
  Viewer.cookie = encrypted tokens
    > HttpOnly, Secure, SameSite=Lax.
```

- `api/auth/login` checks the return path is a diffmap.dev path, so the sign-in cannot redirect elsewhere.
- `api/auth/callback` exchanges the code with the app's client secret, an environment variable in Vercel.
- `api/auth/session` tells the viewer whether it is signed in, and who as: `{ login, avatarUrl }` or `null`.
- `api/auth/logout` clears the cookie.

The cookie holds the access token, the refresh token, and their expiry, encrypted with a key in Vercel's environment. There is no session table: signing out on one browser does not sign out others, and rotating the key signs everyone out. Access tokens last eight hours, and [Phase 3](04-private-repos.md)'s proxy refreshes them as it goes.

Requests that change anything, such as `logout` and Phase 4's review, are `POST`s that check the `Origin` header is diffmap.dev.

## The viewer

The hosted apps, [[src/github/GitHubApp.tsx#GitHubApp]] and [[src/gist/GistApp.tsx#GistApp]], ask `api/auth/session` once on load and show the button or the avatar. [[src/host/GitHubFailurePage.tsx#GitHubFailurePage]] offers **Sign in with GitHub** on its not-found and rate-limited pages, since signing in fixes both: a 404 is how GitHub answers an anonymous request for a private repo.

## Environment

The functions read three variables, set in the diffmap Vercel project: `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, and `DIFFMAP_SESSION_KEY`. Preview deployments of diffmap.dev need a second GitHub App, or sign-in disabled, because GitHub only returns to the callback URLs registered on the app.

```changes

```
