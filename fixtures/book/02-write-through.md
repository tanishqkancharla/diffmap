# ⏳ Phase 2: Write through

[Phase 1](01-sessions-table.md) added the `sessions` table. This phase writes every new session to it, as well as to memory.

**Today**

`createSession` stores the session in a map.

**Proposed**

`createSession` inserts a row before it answers, so a session survives a restart.

```mermaid diff [Sessions reach Postgres]
 flowchart LR
   API --> Cache[Memory cache]
+  API --> Postgres
```

## Tests

A test restarts the API between two requests with the same cookie.
