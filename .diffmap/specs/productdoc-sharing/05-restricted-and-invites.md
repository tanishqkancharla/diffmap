# Phase 4: Restricted access and invitations

Only people the owner adds by email can open the link.

**Today, after Phase 3:** every link is public.

**Proposed**

- Restricted becomes the default for a first share. As in Halo, there's no browser frame for Restricted.
- People without an account get an email from `share@productdoc.dev`, and sign in with that address.
- Access matches every verified email on the reader's linked accounts.
- The "no access" page names the signed-in account, and never reveals whether the document exists.
- CLI: `product-doc share --restricted --add ada@acme.com`, or `--public`.
- Switching to Restricted purges cached public files.

## Expected flows

**Sharing with people**

1. You open the dialog. Access is Restricted.
2. You add ada@acme.com and grace@acme.com. The button reads **Share with 2 people**.
3. You click it. Ada and Grace each get an email with the link.

```flow [Sharing with people]
share-dialog--first-share
  share-dialog--people-added: Add ada@acme.com and grace@acme.com
    share-dialog--signing-in: Click "Share with 2 people"
      share-dialog--sharing: Allow it in the productdoc.dev popup
        share-dialog--shared: The upload finishes
  share-dialog--choose-public: Choose Public
  share-dialog--invalid-email: Add "ada@acme"
```

**An invited person opens the link**

1. Ada opens the link from her email. She's asked to sign in.
2. She signs in with Google as ada@acme.com, and the document opens.
3. If she signs in with her personal address instead, she's told she doesn't have access, and can switch accounts.

```flow [Opening a Restricted link]
share-shared-page--restricted-signed-out
  share-shared-page--invited-signed-in: Sign in with Google as ada@acme.com
  share-shared-page--wrong-account: Sign in as ada@gmail.com
```

**Opening it from a linked account**

1. Ada links her GitHub account to her Google one.
2. Later she signs in with GitHub. The document still opens.

**Someone uninvited gets the link**

1. A stranger opens the link and signs in.
2. They're told they don't have access, and can't tell whether the document exists.

**Removing someone**

1. You open the dialog and remove Grace. The button reads **Unshare with 1 person**.
2. You click it. Grace's next visit says she doesn't have access.

```preview [The dialog on a document shared with people]
share-dialog--shared-with-people
```

**Making it public later**

1. You switch a Restricted document to Public. Anyone with the link can open it.
2. You switch it back. Ada and Grace still have access, without being invited again.

**Agents share with people too**

1. You ask your agent to share the document with Ada.
2. Ada gets the same email as if you'd shared from the dialog.

## Todos

- [ ] `document_member` and `user_email` tables
- [ ] Restricted in the dialog, with adding and removing people
- [ ] `--restricted`, `--add`, and `--public`
- [ ] Access checks on every manifest and file request
- [ ] Reader sign-in, and the "no access" page
- [ ] Invitation emails, with the daily limit
- [ ] Cache purge when access tightens
- [ ] Make Restricted the default

```changes

```
