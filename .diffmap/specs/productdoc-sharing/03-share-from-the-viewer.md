# Phase 2: Share from the viewer

A Share button and dialog in the local viewer, running the same upload as Phase 1. Public only for now.

**Today:** the header has the title, Diff, and Close server ([[src/viewer/ViewerApp.tsx#ViewerApp]]).

**Proposed**

```preview [The header button]
share-header-button--not-shared
share-header-button--shared
```

```flow [Sharing for the first time]
share-dialog--public-first-share
  share-dialog--signing-in: Click "Share"
    share-dialog--sharing: Approve the code in the popup
      share-dialog--shared: The upload finishes
      share-dialog--upload-failed: A file is over the limit
```

- As in Halo, Public shows a browser frame with the cover at `productdoc.dev/d/<id>`, so the document clearly gets its own address.
- Restricted is greyed out until [Phase 4](05-restricted-and-invites.md). "Share with team" says "Coming soon".
- The dialog lists the source files that become public.
- Sign-in goes through `serve`, so the token never reaches the page and is shared with the CLI.

```services [Signing in from the dialog]
service Dialog "share dialog"
service Serve "product-doc serve"
service Auth "productdoc.dev"

step "Get a code"
  Dialog -> Serve: POST /__diffmap/auth/start
  Serve -> Auth: POST /device/code
step "Approve it in a popup"
  Dialog -> Auth: open /device?code=4F2A-91BC
step "serve keeps the token"
  Serve -> Auth: POST /device/token (polling)
  Serve -> Dialog: signed in
```

The mockup is [[src/viewer/share/ShareForm.tsx#ShareForm]]. Run `npm run previews` to make these blocks live.

## Todos

- [ ] `ShareButton` in the header
- [ ] `ShareForm` in a Maui `Dialog`, Public only
- [ ] `/__diffmap/auth/start` and `/__diffmap/share` on `serve`, reusing Phase 1's upload
- [ ] A way to reopen the sign-in popup when the browser blocks it
- [ ] Errors: refused upload, lost connection, declined sign-in

```changes

```
