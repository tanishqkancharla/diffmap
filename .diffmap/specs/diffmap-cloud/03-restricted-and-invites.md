# Phase 2: Restricted access and invitations

[Phase 1](02-share-dialog.md) added the share dialog with Public access. This phase adds **Restricted**: only the people the owner adds by email can open the link. People without a diffmap account get an invitation to sign in.

**Today, after Phase 1**

Every shared spec is public to anyone with its link.

**Proposed**

The dialog's access menu offers **Restricted**, "Only people you've added get access", as in Halo. It is the default for a spec's first share, so nothing becomes public without the owner choosing it. Choosing it shows:

- **Add people by email**, which checks each entry is a full address, such as name@example.com.
- **People with access**: the owner first, then each person added, each with a remove button. While there are unsaved changes, the heading reads "People · changes apply when you share".
- The main button names the change: **Share with 2 people**, **Unshare with 1 person**, **Restrict access**, **Make public**, or **Update access**.

The CLI takes the same choices: `diffmap share <dir> --restricted --add ada@acme.com --add grace@acme.com`, or `--public`.

## Invitations

When the owner shares with someone, the Worker emails them through Cloudflare Email Sending, from `share@diffmap.dev`:

```text [The invitation]
Subject: Tanishq shared "Session store" with you

Tanishq Kancharla (tanishq@example.com) shared a diffmap spec with you.

  Open "Session store"  →  https://diffmap.dev/s/k3v9q2xa7m

Sign in with Google or GitHub using ada@acme.com to open it.
```

A person who already has a diffmap account gets the same email without the last line. Removing someone sends nothing; their access ends at once.

## Opening a Restricted link

```mermaid [A reader opens a Restricted link]
flowchart TD
    O[Open diffmap.dev/s/id] --> S{Signed in?}
    S -->|yes| M{"Invited email?"}
    S -->|no| I[Sign in with Google or GitHub]
    I --> M
    M -->|yes| V[The spec]
    M -->|no| N["You don't have access. Signed in as ada@gmail.com. Switch account, or link another account"]
```

The Worker checks access on every request for the manifest and every blob. It matches the spec's `spec_member` emails against `user_email`, which holds every verified address on the reader's linked accounts. So a reader invited at their work Google address can also open the link after signing in with a GitHub account linked to it.

The "no access" page names the account the reader is signed in with and offers to switch accounts or link another, since a wrong account is the usual cause. It does not say whether the spec exists, so a stranger guessing links learns nothing.

## Previews and HTML in Restricted specs

[Phase 4](05-previews-and-html.md) runs previews and HTML in frames on `<id>.diffmapusercontent.com`, which cannot read diffmap.dev's cookie. For a Restricted spec, diffmap.dev gives each frame a short-lived signed link. The usercontent Worker checks it once, then sets a `Partitioned` cookie for that spec's subdomain, so the frame keeps working inside diffmap.dev and nowhere else.

## Changing access later

Switching a spec from Public to Restricted takes effect at once for new requests. Public blobs may already sit in Cloudflare's cache under their hash, so the switch purges the spec's URLs from it. Switching to Public keeps the member list, so switching back restores it, as Halo does.

```changes

```
