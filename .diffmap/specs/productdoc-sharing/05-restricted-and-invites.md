# Phase 4: Restricted access and invitations

Only people the owner adds by email can open the link.

**Today, after Phase 3:** every link is public.

**Proposed**

```flow [Sharing with people]
share-dialog--first-share
  share-dialog--people-added: Add ada@acme.com and grace@acme.com
    share-dialog--signing-in: Click "Share with 2 people"
      share-dialog--sharing: Approve the code in the popup
        share-dialog--shared: The upload finishes
  share-dialog--choose-public: Choose Public
  share-dialog--invalid-email: Add "ada@acme"
```

```preview [A document shared with people]
share-dialog--shared-with-people
```

- Restricted becomes the default for a first share. As in Halo, there's no browser frame for Restricted.
- People without an account get an email from `share@productdoc.dev` and sign in with that address.
- Access matches every verified email on the reader's linked accounts.
- The "no access" page names the signed-in account, offers to switch or link accounts, and never reveals whether the document exists.
- CLI: `product-doc share --restricted --add ada@acme.com`, or `--public`.
- Switching to Restricted purges cached public blobs.

## Todos

- [ ] `document_member` and `user_email` tables
- [ ] Restricted in the dialog, with adding and removing people
- [ ] `--restricted`, `--add`, and `--public`
- [ ] Access checks on every manifest and blob request
- [ ] Reader sign-in, and the "no access" page
- [ ] Invitation emails, with the daily limit
- [ ] Cache purge when access tightens
- [ ] Make Restricted the default

```changes

```
