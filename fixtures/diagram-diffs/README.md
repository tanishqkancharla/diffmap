# Diagram diffs

Add `diff` after `mermaid` or `services` to mark what a change adds and removes. Start each line with `-` for Today only, `+` for Proposed only, or a space for both, the same as a call stack diff.

## Flowchart

Today the handler saves every record. The proposed flow validates first and returns an error before storage. `Service` keeps its id but changes its label, so it shows as changed.

```mermaid diff [Invalid records stop before storage]
 flowchart LR
   Client -->|record| Handler[requestHandler]
-  Handler -->|record| Service[existingService]
+  Handler -->|record| Validate[validateInput]
+  Validate -->|valid record| Service[existingService + audit]
+  Validate -->|invalid| Error[Return name error]
   Service -->|record| Storage[(Storage)]
```

## Sequence

The cache read goes away; the API reads Postgres directly and publishes the change.

```mermaid diff [Post reads skip the cache]
 sequenceDiagram
   participant Browser
   participant API
-  participant Cache
   participant Postgres
+  participant Hub
   Browser->>API: GET /post/1
-  API->>Cache: get post:1
-  Cache-->>API: miss
   API->>Postgres: SELECT post
   Postgres-->>API: row
+  API->>Hub: post.viewed
   API-->>Browser: 200
```

## Services

Today, sessions live in an in-memory cache inside the API. The proposed flow drops the cache and writes sessions to Postgres, so a restart keeps users signed in. Step through to watch each side's state.

```services diff
 service Browser "login page"
   state cookie = none
 service API "HTTP server"
   service Auth
     state failedAttempts = 0
-  service SessionCache "in-memory"
-    state active = 0
+  service Sessions
 service Postgres
-  state sessions = not used
+  state sessions = 0 rows

 start "Sessions move from memory to Postgres"
   > Alice logs in, and the API stores her session. Today it lives in an in-memory cache and is lost on restart; after the change, Sessions writes it to Postgres.

 step "Alice submits the login form"
   Browser -> API: POST /login
 step "Auth checks the password"
   API -> Auth: verify(alice)
-step "Auth caches the session in memory"
   Auth -> SessionCache: create(alice)
   SessionCache.active = 1
     > Lost when the server restarts.
+step "Auth asks Sessions to store the session in Postgres"
   Auth -> Sessions: create(alice)
   Sessions -> Postgres: INSERT s_81f
   Postgres.sessions = 1 row
     > Survives a restart.
 step "The API sets the session cookie"
   API -> Browser: 200 Set-Cookie
   Browser.cookie = sid=s_81f
```

## Text and table state

Today a failed send is dropped; the proposed queue keeps it and retries. Rows only Today has are red, rows only Proposed has are green, and cells that differ show both values.

```services diff
 service Local "IndexedDB"
   table pending
     | id | mutation        | status |
-    | m1 | complete todo 3 | queued |
+    | m1 | complete todo 3 | sending |
+    | m2 | delete todo 4   | queued |
-    | m0 | rename todo 2   | failed |
   text policy
     | On a network error:
-    | - drop the mutation
+    | - keep it and retry with **backoff**
 service Supabase

 start "Failed sends retry instead of disappearing"
   > Both versions send m1. Today a network error drops it; the proposal keeps it queued and retries.

 step "The worker sends m1"
   Local -> Supabase: m1
   Local.pending[m1].status = sent
 step "The network drops the request"
-  Local.pending -= m1
+  Local.pending[m1].status = retrying
     > Still queued, so the next attempt can send it.
+step "The retry succeeds"
+  Local -> Supabase: m1
+  Supabase -> Local: ack m1
+  Local.pending -= m1
```
