# Examples: five flows in a real app

These blocks are live. They load `fixtures/previews-app`, a small React app with a log-in screen, sign-up, checkout, docs search, and a file upload. Each screen has Storybook stories, and each story that needs the server answers from its own `msw` handlers, such as a 401 for a wrong password or a 413 for a file over 10 MB. To see them, run `npm install && npm run dev` in `fixtures/previews-app`, then `npm run cli -- serve .diffmap/specs/ui-previews` from the repo root.

Each state lists its happy path first, so the next-step button follows it; the arrow beside it opens the other steps. Clicking one plays that step on the live screen. "Show all states" opens the flow as a tree, where clicking a state jumps straight to it, as the breadcrumbs do. The expand button in each flow's header opens the outline, the live screen, and the tree side by side.

## Log in

What a developer building log-in wants to see: every screen a person can hit, how they connect, and what happens between them, such as the spinner turning into an error. Most of these screens depend on what the server answered, so each step's story sets the fake server's answer and does what the person does.

```flow [Logging in]
auth-log-in--empty
  auth-log-in--filled: Fill in email and password
    auth-log-in--two-factor: Log in
      auth-log-in--signed-in: Enter the code
    auth-log-in--wrong-password: Log in with the wrong password
    auth-log-in--locked: Log in after too many tries
  auth-log-in--invalid-email: Type an email without a domain
  auth-log-in--forgot: Click "Forgot password?"
    auth-log-in--reset-sent: Send the reset link
```

## Sign up

```flow [Signing up]
auth-sign-up--empty
  auth-sign-up--weak-password: Fill in the form with a short password
    auth-sign-up--strong-password: Make the password stronger
      auth-sign-up--verify-email: Create the account
      auth-sign-up--email-taken: Create the account, email already used
      auth-sign-up--server-down: Create the account, server error
```

## Checkout

```flow [Checking out]
shop-checkout--cart
  shop-checkout--shipping: Check out
    shop-checkout--payment: Enter the address
      shop-checkout--placed: Pay
      shop-checkout--declined: Pay with a card that's declined
        shop-checkout--retry-after-decline: Try another card
```

## Search

```flow [Searching the docs]
docs-search--idle
  docs-search--results: Search for "webhooks"
  docs-search--loading: Search on a slow connection
  docs-search--no-results: Search with a typo
  docs-search--failed: Search while the service is down
    docs-search--retry-succeeds: Try again
```

## Upload

```flow [Uploading a statement]
billing-upload-statement--empty
  billing-upload-statement--uploaded: Choose a file
  billing-upload-statement--uploading: Choose a file, still uploading
  billing-upload-statement--too-large: Choose a file over 10 MB
  billing-upload-statement--connection-dropped: Choose a file, connection drops
```

## Components on their own

A `preview` block shows stories side by side, without a journey.

```preview [Buttons and alerts]
design-button--primary
design-button--secondary
design-button--pending
design-button--alerts
```

```preview [The log-in screen on its own]
auth-log-in--empty
```
