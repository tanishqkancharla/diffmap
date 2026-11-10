# ✅ Phase 1: Sessions table

The [cover](README.md) explains why sessions move out of memory. This phase only adds the table they move to.

**Today**

Postgres has no table for sessions.

**Proposed**

A `sessions` table holds one row per signed-in browser.

```sql
create table sessions (
  id text primary key,
  user_id text not null,
  expires_at timestamptz not null
);
```
