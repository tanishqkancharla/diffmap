# diffmap

**Your coding agent writes more code than you can review.**

**Review the important design changes, not massive line diffs.**

`diffmap` is a living spec your agent writes before it codes. You review the plan, then each phase as it lands.

Ask your agent to plan new work as a spec:

```text
Plan <feature> as a diffmap spec. Use github.com/tanishqkancharla/diffmap
```

Or to write one for work already on a branch:

```text
Write a diffmap spec for the changes on this branch. Use github.com/tanishqkancharla/diffmap
```

For an example, see [the spec for shared workspace memory](https://diffmap.dev/cashew-labs/halo/commit/b01ac5e0633c906efb1d09bf164da46b8bed2b04/.diffmap/shared-workspace-memory.md) in [Halo](https://github.com/cashew-labs/halo).

If you like the result, install the skill:

```sh
npx skills add tanishqkancharla/diffmap --skill generate-diffmap
```

`diffmap` is [open source](https://github.com/tanishqkancharla/diffmap) and MIT licensed. Specs run locally, or you can [share one with a link](#share-a-spec-with-a-link-experimental) on diffmap.dev.

## 1. Review the plan

Before it writes code, your agent shows what each phase will change, with diagrams that link to the code they touch.

### Service diagrams

A service diagram shows how state moves between services, one step at a time. Press **Play**:

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

### Mermaid diagrams

A Mermaid diagram shows how the pieces connect, and what a change adds or removes:

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

### Call stacks

A call stack follows the data from one call to the next:

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

### Comments

Highlight any text or code line to comment on the plan, then copy every comment back to your agent. Try it on this page.

## 2. Review each phase

Your agent builds the plan one phase at a time, one commit each. A finished phase shows its commit with the files to read first, and links like [[src/sessions/store.ts#SessionStore.find]] open the code:

```changes
5e5510a
src/sessions/store.ts
src/middleware/requireSession.ts
src/routes/login.ts
migrations/0004_sessions.sql
```

```callstack
 response = login(req, res) [[5e5510a:src/routes/login.ts#L5-L14]]
-├── session = createSession(user.id) # kept in a Map in the server
+├── session = await sessions.create(user.id) [[5e5510a:src/routes/login.ts#L11]]
+│   └── INSERT INTO sessions (id, user_id, expires_at) [[5e5510a:src/sessions/store.ts#L18-L21]]
 └── res.cookie("sid", session.id) [[5e5510a:src/routes/login.ts#L12]]
```

## Share a spec with a link :badge[Experimental]

If your spec is in a public GitHub pull request or commit, swap `github.com` for `diffmap.dev` in its link and add the spec's path. For example, the Halo spec above is in [github.com/cashew-labs/halo/pull/632](https://github.com/cashew-labs/halo/pull/632), so it opens at [diffmap.dev/cashew-labs/halo/pull/632/.diffmap/shared-workspace-memory.md](https://diffmap.dev/cashew-labs/halo/pull/632/.diffmap/shared-workspace-memory.md).

Otherwise, one command uploads your spec as an unlisted gist and prints its link:

```sh
npx @tanishqkancharla/diffmap share specs/search.md
# prints https://diffmap.dev/g/<gistId>
```

::details{summary="What a shared link exposes"}

- **A pull request or commit link** uploads nothing. It shows what the public repo already shows.
- **A gist** holds a copy of the spec, the diff behind every changes card, uncommitted ones included, and the full contents of every file it quotes or links without a commit.
- **An unlisted gist** stays out of search, but anyone with the link can read it. Only share a spec you would be fine putting on the public internet, and delete the gist to take it down.

::
