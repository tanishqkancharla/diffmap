import type { Page } from "./content.ts";

/** One fixture-backed story, seen at three stages of working with an agent. */
export const examples = [
  {
    path: "/examples/explain",
    kind: "Explain",
    question: "Why does a deploy sign everyone out?",
    summary:
      "Follow a login from the browser cookie to the API’s memory—and see what a restart loses.",
    contents: "Request walkthrough · Service playback · Source links",
    prompt:
      "Use generate-product-doc to explain how login sessions work in this project and why users lose their session after a deploy. Don’t change the code.",
  },
  {
    path: "/examples/plan",
    kind: "Plan",
    question: "How do we keep users signed in?",
    summary:
      "Compare the options, choose durable session storage, and split the work into two reviewable changes.",
    contents: "Decision and tradeoffs · Two change pages · Verification",
    prompt:
      "Use generate-product-doc to plan sessions that survive deploys and work across API instances. Compare the options and put each small change on its own page. Don’t implement it yet.",
  },
  {
    path: "/examples/review",
    kind: "Review",
    question: "What changes when sessions move to Postgres?",
    summary:
      "Review the user-visible difference, the request path, and the exact code behind the change.",
    contents: "Before and after · Call-stack diff · Six-file patch",
    prompt:
      "Use generate-product-doc to review the session-storage change on this branch. Explain what changes for users, show the important before and after, and call out remaining risks.",
  },
] as const;

const examplesIntroduction = `# Less guessing. A document you can explore.

Your coding agent can explain a system, plan a change, or walk you through the result. Productdoc gives you a shared place to reason about the screens, services, and behavior—not just the files it touched.

## One problem. Three useful conversations.

A deploy signs everyone out of a small web app. Follow the same story from understanding the bug to deciding on a fix and reviewing the work.

These are hand-authored sample documents backed by the repository’s fictional session-store app, not customer projects or a claim that an agent generated them. The diagrams, playback, source links, and diff use the real Productdoc reader.
`;

const examplesNext = `## Bring your own project

Start with a question about a workflow you know. Read the explanation and diagrams first; open the code when you need to check a detail. You can also include screenshots, recordings, or live component previews when the question is about UI.

[Set up Productdoc](/docs/quickstart)
`;

export const examplePages: Page[] = [
  {
    path: "/examples",
    title: "Examples you can explore",
    label: "Examples · Working with a coding agent",
    description:
      "Explore finished interactive Productdoc documents: understand a login flow, plan durable sessions, and review the change.",
    body: `${examplesIntroduction}\n${examples.map((example) => `### ${example.kind}: ${example.question}\n\n${example.summary}\n\n${example.contents}\n\n[Open the ${example.kind.toLowerCase()} document](${example.path})\n\nAsk your agent:\n\n> ${example.prompt}`).join("\n\n")}\n${examplesNext}`,
  },
  {
    path: "/examples/explain",
    title: "Why a deploy signs everyone out",
    label: "Explain · Sample app, current behavior",
    description:
      "An interactive explanation of a browser cookie, an in-memory session, and the restart that separates them.",
    body: `# Why a deploy signs everyone out

Alice signs in, opens her orders, and everything works. The team deploys a new API version. Alice’s next request asks her to sign in again—even though her browser still has the cookie.

**The cookie is a key, not the session.** The browser keeps the key; this API process keeps the session. A restart destroys only the second half.

## Follow Alice’s session

Play through the request and watch the cookie and session count. The same cookie succeeds before the restart and fails after it.

\`\`\`services
service Browser "Alice’s browser"
  state cookie = none
service API "one running process"
  state sessions = 0

start "A cookie outlives the API’s memory"
  > The browser holds an ID. The API must still have a matching session to know who Alice is.
step "Alice signs in"
  Browser -> API: POST /login
  API.sessions = 1
step "The browser keeps the key"
  API -> Browser: Set-Cookie sid=s_81f
  Browser.cookie = sid=s_81f
step "Alice asks for her orders"
  Browser -> API: GET /orders with sid=s_81f
step "The API recognizes Alice"
  API -> Browser: 200 Alice’s orders
step "The API restarts during a deploy"
  API.sessions = 0
    > A new process starts with an empty Map. The browser cookie has not changed.
step "Alice sends the same cookie after the deploy"
  Browser -> API: GET /orders with sid=s_81f
step "The API asks Alice to sign in again"
  API -> Browser: 401 Sign in again
\`\`\`

## Who owns what?

- **Browser:** sends the session ID in an HTTP-only cookie. A cookie does not contain the user’s orders or the server’s session record.
- **Login route:** checks credentials, creates a session, then sets the cookie. Open [[src/routes/login.ts#login]] to see that order.
- **API memory:** owns the ID-to-user mapping and seven-day expiry. Open [[src/sessions/memory.ts#findSession]] to see the lookup.
- **Request guard:** rejects requests without a valid session before the orders handler runs. Open [[src/middleware/requireSession.ts#requireSession]].

\`\`\`ts
// Pseudocode: a valid cookie still needs a matching server-side record.
const session = sessions.get(request.cookies.sid);
if (!session || session.expiresAt < now()) return unauthorized();
return ordersFor(session.userId);
\`\`\`

## It is not only a deploy problem

With two API instances, Alice can log in on instance A and have her next request reach B. B has a different Map, so it cannot find the session. Sticky routing can mask this, but it cannot preserve memory after a restart.

This sample explains inspected fixture code. It does not establish that a production app has this bug, and it does not change the app.

[Next: plan sessions that survive deploys](/examples/plan)
`,
  },
  {
    path: "/examples/plan",
    title: "Keep users signed in across deploys",
    label: "Plan · Proposed change to the sample app",
    description:
      "A product-level decision and two small changes for moving session ownership out of API memory.",
    body: `# Keep users signed in across deploys

**Today:** a deploy signs Alice out, and a second API instance cannot recognize her session. **Proposed:** store sessions outside the API process, so a valid cookie works after a restart and on any instance.

## The decision: use the database we already have

The sample app already connects to Postgres. Add a sessions table and a small store with create and find operations. Keep the browser’s cookie and the seven-day session length unchanged.

Redis could own sessions too, but would add another service to operate for this app. Sticky routing still loses sessions when an instance restarts. A self-contained signed token avoids a lookup but changes expiry and revocation tradeoffs; that is a different authentication design, not this small fix.

\`\`\`mermaid
flowchart TD
  Browser[Browser with a session cookie] --> API[Either API instance]
  API --> Store[Shared session store]
  Store --> DB[(Postgres sessions)]
  DB --> Result{Live session exists?}
  Result -->|Yes| Orders[Show Alice’s orders]
  Result -->|No| SignIn[Ask Alice to sign in]
\`\`\`

## What success means

- Alice can use the same cookie after the API restarts.
- Either API instance recognizes an unexpired session.
- Missing and expired sessions still return 401.
- If storage fails, the API must not authenticate the request or issue a cookie for an unsaved session.

No refresh-token redesign, cross-device sign-out, or new login screen. Existing in-memory sessions will not be copied; the first rollout still requires one new login. The promise applies to sessions created in the new store.

## Two small changes, not one giant patch

1. [Add durable session storage](/examples/plan/read). Add the table and store without changing request behavior. Review the schema, expiry rule, and persistence checks.
2. [Switch login and authenticated requests](/examples/plan/serve). Once storage exists, move both request paths together and remove the unused Map. Review failure behavior and the restart scenario.

## A detail worth deciding before coding

What should Alice see when Postgres is unavailable? Treat a database failure as a service error rather than “wrong password” or a missing session. The implementation should use the app’s error handling and never silently fall back to a per-process Map.

\`\`\`ts
// Proposed behavior, not an implemented API.
const session = await store.create(user.id); // may fail
response.setCookie("sid", session.id);      // only after a successful write
\`\`\`

This is a sample proposal, not authorization to implement it. The review example shows a bundled implementation and its remaining limits.
`,
  },
  {
    path: "/examples/plan/read",
    title: "1. Add durable session storage",
    label: "Plan · Proposed change 1 of 2",
    description:
      "One reviewable change: a sessions table and a store, without switching the live request paths.",
    body: `# 1. Add durable session storage

[The cover](/examples/plan) chooses Postgres so sessions outlive the API process. This first change adds storage without changing how anyone signs in.

**Today:** sessions exist only in a Map. **Proposed:** add a sessions table with a primary-key ID, user ID, and expiry; expose create and find operations through a store. Keep the existing routes on memory until the next change.

## The contract

Create writes before returning a session. Find returns only a row whose expiry is strictly later than the database’s current time. At the expiry boundary, the session is no longer valid. A database error stays an error, rather than becoming “session not found.”

\`\`\`ts
// Proposed store contract; SQL and migration details come after this decision.
type Session = { id: string; userId: string; expiresAt: Date };
type SessionStore = {
  create(userId: string): Promise<Session>;
  find(id: string): Promise<Session | undefined>;
};
\`\`\`

## Verify this change

Create a session, construct another store using the same database, and find the same user by ID. Check an unknown ID, an expired row, and a row exactly at expiry. Make the database unavailable and check that both operations fail rather than fabricate a session.

This page does not switch routes, add a cleanup job, or claim the migration ran in production. Deleting expired rows is storage maintenance; rejecting them during lookup is the authentication guarantee.

[Next: switch both request paths](/examples/plan/serve)
`,
  },
  {
    path: "/examples/plan/serve",
    title: "2. Switch login and authenticated requests",
    label: "Plan · Proposed change 2 of 2",
    description:
      "Move session creation and lookup together, then check restarts, multiple instances, and failures.",
    body: `# 2. Switch login and authenticated requests

[Change 1](/examples/plan/read) supplies durable storage. This change makes requests use it. Switching only login would leave the guard looking in an empty Map; switching only the guard would leave new sessions unwritten.

**Today:** login and the request guard share memory in one process. **Proposed:** both use the same Postgres-backed store. Delete the unused in-memory session module after its callers are moved.

## Keep the order visible

\`\`\`ts
// Proposed request behavior, simplified.
async function login(user: User) {
  const session = await store.create(user.id);
  return signedInResponse(session.id); // do not set a cookie before the write
}
async function orders(cookie: string) {
  const session = await store.find(cookie);
  if (!session) return unauthorized();
  return ordersFor(session.userId);
}
\`\`\`

## Verify from Alice’s browser

Sign in, keep the cookie, restart the API, then fetch orders: the same user should still receive 200. Send that cookie to another instance using the same database. Repeat with missing and expired sessions: both must receive 401. Reject incorrect credentials without writing a session.

Stop Postgres during login and check that no session cookie is issued. Stop it during an authenticated request and check that the service error does not leak another user’s data or fall back to memory.

## Rollout boundary

Apply the migration before switching requests. Old in-memory sessions are not migrated, so communicate the one-time sign-in. Do not drop the table if the API must be rolled back; review the rollback separately from the code switch.

[Return to the plan](/examples/plan) · [Explore the sample implementation review](/examples/review)
`,
  },
  {
    path: "/examples/review",
    title: "Review the move to Postgres sessions",
    label: "Review · Bundled sample patch, not a production release",
    description:
      "Explore a concrete six-file patch through its user-visible result, source links, and remaining risks.",
    body: `# Review the move to Postgres sessions

Alice’s cookie now points to a row in Postgres, not a Map inside one API process. A restart no longer deletes that row, and another instance using the same database can look it up.

This review uses the repository’s bundled before/after fixture. The revision ID is a sample identifier, not a GitHub commit or a production deployment. The code links and Diff open that local fixture patch; the scenarios below are review checks, not a claim that this page executed the app.

## What changed for a request?

The browser still sends the same kind of cookie. The important change is where [[src/middleware/requireSession.ts#requireSession]] looks up its owner:

\`\`\`callstack
 response = handle(GET /orders)
 ├── requireSession(req, res, next) [[src/middleware/requireSession.ts#requireSession]]
-│   ├── session = findSession(req.cookies.sid)
-│   │   └── return sessions.get(id) # lost on restart
+│   ├── session = await store.find(req.cookies.sid) [[src/sessions/store.ts#SessionStore.find]]
+│   │   └── return live row from Postgres # shared by API instances
 │   └── res.locals.session = session
 └── return ordersFor(session.userId)
\`\`\`

## A cookie must name a saved session

[[src/routes/login.ts#login]] now awaits the write before setting the cookie. If the write rejects, execution never reaches the cookie call. The patch does not show a custom database-error screen or a complete error-handling policy.

\`\`\`diff
-const session = createSession(user.id);
+const session = await sessions.create(user.id);
 res.cookie("sid", session.id, { httpOnly: true, expires: session.expiresAt });
\`\`\`

## Expiry is enforced during lookup

[[src/sessions/store.ts#SessionStore.find]] filters out rows whose expiry is not later than now. Cleanup can wait without allowing an expired session to authenticate. A cleanup job is not part of this six-file patch.

\`\`\`ts
// Pseudocode for the new request decision.
const session = await store.find(cookie);
if (!session) return unauthorized();
return ordersFor(session.userId);
\`\`\`

## Review the patch in this order

Start with the store and migration, then the guard and login route. The database module constructs the shared store; the old memory module is deleted. Open Diff to inspect all six files, or choose one source link for the detail behind the explanation.

\`\`\`changes
5e5510a
src/sessions/store.ts
migrations/0004_sessions.sql
src/middleware/requireSession.ts
src/routes/login.ts
\`\`\`

## What I would check before shipping

- Use the same cookie before and after an API restart, then on a second API instance.
- Check unknown, expired, and exactly-at-expiry sessions; none should authenticate.
- Confirm failed writes never issue a cookie, and database failures reach the app’s service-error handling.
- Apply the migration before the API change. Existing memory-only sessions still require one new sign-in.

The sample patch demonstrates the storage change, not a complete production authentication system. Logout, rate limiting, cookie security policy, and expiry cleanup need their own review in the real app.

[Back to all examples](/examples) · [Try Productdoc in your project](/docs/quickstart)
`,
  },
];
