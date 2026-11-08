# Store login sessions in Postgres

Today the API keeps sessions in a `Map` in server memory, so every deploy or restart signs everyone out, and a second API instance cannot see sessions the first one created. This change moves sessions into a `sessions` table behind a small [[src/sessions/store.ts#SessionStore]], so a session survives restarts and every instance sees the same sessions.

## Goals

- A deploy or restart does not sign anyone out.
- Every API instance reads the same sessions.
- Expired sessions never authenticate a request.

Non-goals: refresh tokens, and signing out other devices.

## How the pieces connect

[[src/routes/login.ts#login]] and [[src/middleware/requireSession.ts#requireSession]] stop reading the in-memory map and call one store instead:

```mermaid diff [Sessions move out of server memory]
 flowchart LR
   Login[POST /login] --> LoginRoute[login]
   Orders[GET /orders] --> Guard[requireSession]
-  LoginRoute --> Memory[(Map in server memory)]
-  Guard --> Memory
+  LoginRoute -->|create| Store[SessionStore]
+  Guard -->|find| Store
+  Store -->|SQL| Postgres[(sessions table)]
   %% ref node:LoginRoute [[src/routes/login.ts#login]]
   %% ref node:Guard [[src/middleware/requireSession.ts#requireSession]]
   %% ref node:Store [[src/sessions/store.ts#SessionStore]]
   %% ref node:Postgres [[migrations/0004_sessions.sql]]
   %% ref edge:2 [[5e5510a:src/routes/login.ts#L11]]
   %% ref edge:3 [[5e5510a:src/middleware/requireSession.ts#L9]]
```

## What happens when Alice logs in

```services diff
 service Browser "login page"
   state cookie = none
 service API "HTTP server" [[src/routes/login.ts#login]]
-  service Cache "in-memory sessions"
-    state sessions = 0
+  service Sessions [[src/sessions/store.ts#SessionStore]]
 service Postgres [[migrations/0004_sessions.sql]]
-  state sessions = not used
+  state sessions = 0 rows

 start "Sessions move from memory to Postgres"
   > Alice logs in, and the API stores her session. Today it keeps the session in memory, so a server restart signs her out. After the change, Sessions writes it to Postgres, where it survives a restart.

 step "Alice logs in"
   Browser -> API: POST /login
-step "The API keeps the session in memory"
   API -> Cache: create(alice)
   Cache.sessions = 1
     > The server loses this when it restarts.
+step "Sessions writes the session to Postgres"
   API -> Sessions: create(alice) [[src/sessions/store.ts#SessionStore.create]]
   Sessions -> Postgres: INSERT s_81f [[5e5510a:src/sessions/store.ts#L18-L21]]
   Postgres.sessions = 1 row
     > The row survives a restart.
 step "The API sets the session cookie"
   API -> Browser: 200 Set-Cookie [[5e5510a:src/routes/login.ts#L12]]
   Browser.cookie = sid=s_81f
```

## ✅ Phase 1: Read and write sessions in Postgres

**Today:** a restart empties the map, and the next request answers 401 "Sign in again".

**Proposed:** the session row outlives the process, so the same cookie keeps working after a deploy.

Every request that needs a signed-in user goes through `requireSession`. It now awaits the store instead of reading the map:

```callstack
 response = handle(GET /orders)
 ├── requireSession(req, res, next) [[src/middleware/requireSession.ts#requireSession]]
-│   ├── session = findSession(req.cookies.sid) # a Map lookup in this process
-│   │   └── return sessions.get(id) # empty after every restart
+│   ├── session = await sessions.find(req.cookies.sid) [[src/sessions/store.ts#SessionStore.find]]
+│   │   └── return SELECT … WHERE id = $1 AND expires_at > now() # survives restarts
 │   └── res.locals.session = session
 └── return listOrders(res.locals.session.userId)
```

Logging in writes the row before it sets the cookie, so a cookie never names a session that does not exist:

```callstack
 response = login(req, res) [[5e5510a:src/routes/login.ts#L5-L14]]
-├── session = createSession(user.id) # kept in a Map in the server
+├── session = await sessions.create(user.id) [[5e5510a:src/routes/login.ts#L11]]
+│   └── INSERT INTO sessions (id, user_id, expires_at) [[5e5510a:src/sessions/store.ts#L18-L21]]
 └── res.cookie("sid", session.id) [[5e5510a:src/routes/login.ts#L12]]
```

```changes
5e5510a
src/sessions/store.ts
src/middleware/requireSession.ts
src/routes/login.ts
migrations/0004_sessions.sql
```

## Phase 2: Delete expired sessions

**Today:** expired rows stop matching in `find`, but they stay in the table forever.

**Proposed:** an hourly job deletes them, so the table holds only live sessions.

```ts [src/jobs/sweepSessions.ts] {2}
export async function sweepSessions(sql: Sql) {
  const deleted = await sql`DELETE FROM sessions WHERE expires_at < now()`;
  return deleted.count;
}
// [!note L2] The `sessions_expires_at` index from the migration keeps this a range scan, not a full table scan.
// [!note sweepSessions] Registered with the existing hourly job runner, next to the email digest.
```

## Open questions

- [ ] Should signing out delete the row, or only clear the cookie?
- [ ] Is seven days the right session length for mobile clients?
