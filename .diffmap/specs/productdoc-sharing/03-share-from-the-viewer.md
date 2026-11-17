# Phase 2: Share from the viewer

[Phase 1](02-publish-from-the-cli.md) lets an agent publish a document from the CLI. This phase puts the same thing behind a **Share** button in the local viewer's header, with a share dialog modeled on Halo's. It shares publicly only; Restricted arrives in [Phase 5](06-restricted-and-invites.md), and the dialog already has room for it.

**Today, after Phase 1**

The local viewer's header has the document's title, the Diff button, and Close server ([[src/viewer/ViewerApp.tsx#ViewerApp]]). Sharing needs the CLI.

**Proposed**

The header gains a quiet **Share** button beside the Diff button. Once the document is shared, its label reads **Shared**:

```preview [The header's Share button]
share-header-button--not-shared
share-header-button--shared
```

The button opens the share dialog. As in Halo, a Public document shows a small browser frame with the cover at a link like `productdoc.dev/d/8f3k2x…`, so it is clear the document will live at its own address. The flow below runs the proposed dialog with a stand-in for the local server and productdoc.dev, so nothing is uploaded and no one signs in.

```flow [Sharing from the viewer for the first time]
share-dialog--public-first-share
  share-dialog--signing-in: Click "Share"
    share-dialog--sharing: Approve the code in the productdoc.dev popup
      share-dialog--shared: The upload finishes
      share-dialog--upload-failed: productdoc.dev refuses an upload over the limit
```

- The access menu lists Restricted, greyed out until Phase 5, and "Share with team" is marked "Coming soon".
- The note above the buttons lists every source file the share uploads, and says anyone with the link can read them.
- Clicking **Share** the first time starts sign-in, then uploads. The button reads **Signing in…**, then **Sharing…**. Once the upload finishes, the frame shows the real link, **Copy link** works, and the main button reads **Done**.
- If the upload fails, the dialog says which file is over which limit, keeps the person's choices, and offers **Retry**.

These blocks load the viewer's own preview page, which `npm run previews` serves from this checkout. The proposed form is [[src/viewer/share/ShareForm.tsx#ShareForm]], its stories are in [[src/viewer/share/ShareForm.stories.tsx]], and nothing in the viewer renders it yet.

## Signing in from the dialog

The dialog signs in through the local server, with the same device authorization as the CLI, so the token stays in `~/.config/product-doc/auth.json` and a person signed in from either is signed in for both:

```services [Signing in from the share dialog]
service Dialog "share dialog in the local viewer"
service Serve "product-doc serve"
  state token = none
service Auth "productdoc.dev: Better Auth"

start "The dialog signs in through the local server"
  > The token goes to the local server, never to the page, so it is not exposed to the document's content.

step "The dialog asks the local server to sign in"
  Dialog -> Serve: POST /__diffmap/auth/start
  Serve -> Auth: POST /device/code
  Auth -> Serve: device_code, verification_uri_complete
  Serve -> Dialog: the code and its link
step "The person approves in a popup"
  Dialog -> Auth: open /device?code=4F2A-91BC
    > They sign in with Google or GitHub if needed, check the code matches the one in the dialog, and approve.
step "The local server picks up the token"
  Serve -> Auth: POST /device/token (polling)
  Auth -> Serve: session token
  Serve.token = saved to ~/.config/product-doc/auth.json
  Serve -> Dialog: signed in as Tanishq
```

The dialog then calls a new `POST /__diffmap/share` on the local server, which runs the same upload as the CLI. The local server only accepts these requests from its own page: they are JSON `POST`s, which need a CORS preflight that `serve` never grants, as `/__diffmap/telemetry` already relies on in [[src/serve.ts]].

## Todos

- [ ] `ShareButton` in the header, reading Share or Shared
- [ ] `ShareForm` in a Maui `Dialog`, with Public only and Restricted greyed out
- [ ] `/__diffmap/auth/start`, the token polling, and `/__diffmap/share` on the local server, reusing Phase 1's upload
- [ ] The sign-in popup, and a way to reopen it if the browser blocked it
- [ ] Error states for a refused upload, a lost connection, and a declined sign-in
- [ ] Remember the link `serve` made for each document, so the dialog shows it when reopened
- [ ] Replace the stand-in in the stories with the real local server answers, behind the same `ShareApi`

```changes

```
