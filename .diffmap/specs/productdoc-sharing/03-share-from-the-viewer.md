# Phase 2: Share from the viewer

A Share button and dialog in the local viewer, running the same upload as Phase 1. Public only for now.

**Today:** the header has the title, Diff, and Close server ([[src/viewer/ViewerApp.tsx#ViewerApp]]).

**Proposed**

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

The mockups are [[src/viewer/share/ShareForm.tsx#ShareForm]] and [[src/viewer/share/ShareButton.tsx#ShareButton]]. Run `npm run previews` to make these blocks live.

## Expected flows

**Sharing for the first time**

1. You're reading a document in the local viewer, and click **Share** in the header.
2. The dialog shows how the link will look, and which source files become public.
3. You click **Share**. A popup asks you to sign in to productdoc.dev, showing the same code as the dialog.
4. You allow it. The dialog uploads, then shows the link. You click **Copy link**.
5. The header button now reads **Shared**.

```flow [Sharing from the viewer]
share-dialog--public-first-share
  share-dialog--signing-in: Click "Share"
    share-dialog--sharing: Allow it in the productdoc.dev popup
      share-dialog--shared: The upload finishes
      share-dialog--upload-failed: A file is over the limit
```

```preview [The header button, before and after]
share-header-button--not-shared
share-header-button--shared
```

**Already signed in from the CLI**

1. You signed in earlier when your agent shared another document.
2. You click **Share**. There's no popup, and it goes straight to uploading.

**A file is too big**

1. You click **Share**, and the dialog says which file is over the limit.
2. It offers a prompt to copy to your agent: "Make recording.mp4 in session-store smaller than 25 MB, then share it again."
3. Your agent trims it, and you click **Retry**.

**The browser blocks the popup**

1. You click **Share**, and the popup doesn't open.
2. The dialog offers a link to open it yourself, and sharing continues once you allow it.

**Closing the dialog**

1. You close the dialog after sharing, and reopen it.
2. It shows the same link.

## Todos

- [ ] `ShareButton` in the header
- [ ] `ShareForm` in a Maui `Dialog`, Public only
- [ ] `/__diffmap/auth/start` and `/__diffmap/share` on `serve`, reusing Phase 1's upload
- [ ] A way to reopen the sign-in popup when the browser blocks it
- [ ] Errors: refused upload, lost connection, declined sign-in

```changes

```
