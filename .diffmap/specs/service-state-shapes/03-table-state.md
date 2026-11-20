# ✅ Phase 3: Table state

[Phase 1](01-inspectable-state.md) moved rules and decisions out of state, and [Phase 2](02-text-state.md) gave prose its own shape. What is left is records: several fields per item, and items that come and go. This phase adds a `table` shape for them.

**Today**

A record has to be packed into one string, as in `state attempt = state plus verifier`, and a list is narrated instead of shown, as in `React.rows = completed todo removed`. The reader can't see which fields or rows changed.

**Proposed**

A service can hold a table. Its first column names each row. A step changes one cell, adds a row, or removes one, and the card highlights exactly that cell or row. A `services diff` colors rows only Today has red and rows only Proposed has green. Built in c379aba.

## Syntax

The Tandem example from the eval, rewritten:

```text
service Local "IndexedDB"
  table pending
    > Mutations waiting to reach Supabase, oldest first.
    | id | mutation        | status |
    | m1 | complete todo 3 | queued |
service React "todo list"
  table rows
    | id | title        | done  |
    | t3 | Buy milk     | false |
    | t4 | Call plumber | false |

step "Alice completes todo 3 while offline"
  React.rows[t3].done = true
  Local.pending += | m2 | delete todo 4 | queued |
step "The sync worker sends both mutations"
  Local.pending[m1].status = sent
  Local.pending[m2].status = sent
step "Supabase confirms m1"
  Local.pending -= m1
    > Confirmed mutations leave the queue.
```

- `table <key>` declares it. The first indented `| … |` line is the header; every later one is a row with the same number of cells. A Markdown separator row (`|---|---|`) is allowed and ignored.
- The first column names its row and must be unique within the table.
- In a step:
  - `Service.key[row].column = value` changes one cell.
  - `Service.key += | … |` adds a row at the end.
  - `Service.key -= row` removes a row.
- A `>` line under any of them is a note beside that row.
- The packed eval record `attempt = state plus verifier` becomes a table with `id | state | verifier` columns, so each field changes on its own.

## How it looks

Step through it. Each step uses one of the three table changes, and step 4 uses all of them across two services.

```services
service React "todo list"
  table todos
    > What the list shows.
    | id | title        | done  |
    | t3 | Buy milk     | false |
    | t4 | Call plumber | false |
service Local "IndexedDB"
  table pending
    > Mutations waiting to reach Supabase, oldest first.
    | id | mutation        | status |
service Supabase
  table todos
    | id | done  |
    | t3 | false |
    | t4 | false |

start "An offline change reaches Supabase"
  > The list updates at once, the change waits in IndexedDB, and the queue empties once Supabase confirms it.
step "Alice completes todo 3 while offline"
  React -> Local: complete t3
  React.todos[t3].done = true
  Local.pending += | m1 | complete todo 3 | queued |
    > Saved before anything is sent, so a reload keeps it.
step "Alice deletes todo 4"
  React -> Local: delete t4
  React.todos -= t4
  Local.pending += | m2 | delete todo 4 | queued |
step "The network returns and the worker sends both"
  Local -> Supabase: m1, m2
  Local.pending[m1].status = sent
  Local.pending[m2].status = sent
step "Supabase applies them and confirms m1 and m2"
  Supabase -> Local: ack m1, m2
  Supabase.todos[t3].done = true
  Supabase.todos -= t4
  Local.pending -= m1
    > Confirmed mutations leave the queue.
  Local.pending -= m2
```

- **Panel:** a table sits on a soft gray panel under its title, in the card's description text, with hairlines between rows. Its first column is as wide as the card's state keys, so values and columns line up.
- **Changed cell:** its new value in bold teal for that step; ← shows the old one.
- **Added row:** teal for the step that adds it.
- **Removed row:** struck through and gray for the step that removes it, then gone.
- A `>` note on a row change points at that row.

Captured from the [services fixture](../../../fixtures/services/README.md):

:::gallery carousel [Desktop, light]
![Start](media/table-state/sync-step0-1280-light.png)
![1: a row is added and a cell changes](media/table-state/sync-step1-1280-light.png)
![3: cells change](media/table-state/sync-step3-1280-light.png)
![4: rows are removed](media/table-state/sync-step4-1280-light.png)
:::

:::gallery carousel [Desktop, dark]
![Start](media/table-state/sync-step0-1280-dark.png)
![1: a row is added and a cell changes](media/table-state/sync-step1-1280-dark.png)
![3: cells change](media/table-state/sync-step3-1280-dark.png)
![4: rows are removed](media/table-state/sync-step4-1280-dark.png)
:::

At 390 px the services stack in one column, and a table wraps long cells instead of scrolling:

:::gallery grid
![1: added row, light](media/table-state/sync-step1-390-light.png)
![4: removed rows, light](media/table-state/sync-step4-390-light.png)
![1: added row, dark](media/table-state/sync-step1-390-dark.png)
![4: removed rows, dark](media/table-state/sync-step4-390-dark.png)
:::

### In a `services diff`

Rows follow the existing diff rules: a row line takes the sign it starts with, and a `-` or `+` step update applies to that side only. The header has no sign, since both versions share the columns. At each step the card compares Today's table with Proposed's:

- A row only Proposed has is green, with a + in the panel's margin, like an added step's segment.
- A row only Today has is red and struck through, with a −, like a removed step's segment.
- A row both have with different cells shows Today's cell struck through in red beside Proposed's in green, like a key/value row.

Rows are listed in Proposed's order, with each Today-only row after the row it followed in Today.

```services diff
 service Local "IndexedDB"
   table pending
     | id | mutation        | status |
-    | m1 | complete todo 3 | queued |
+    | m1 | complete todo 3 | sending |
+    | m2 | delete todo 4   | queued |
-    | m0 | rename todo 2   | failed |
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

:::gallery grid
![Start, light](media/table-state/diff-step0-1280-light.png)
![2: Today drops m1, light](media/table-state/diff-step2-1280-light.png)
![3: added step, dark](media/table-state/diff-step3-1280-dark.png)
![Start, 390 px dark](media/table-state/diff-step0-390-dark.png)
:::

## Implementation

```ts
type StateChange =
  | { kind: "set"; value: string }
  | { kind: "text"; lines: StateLine[] }
  | { kind: "cell"; row: string; column: string; value: string }
  | { kind: "addRow"; cells: string[] }
  | { kind: "removeRow"; row: string };

// What serviceStateAt stores per key, per side and step.
type StateValue = string | { columns: string[]; rows: string[][] };
```

- [[src/services.ts#parseServiceDiagram]] reads `table <key>`, row lines, and the three updates. It tracks each table's row names per side as it reads the steps, so `Local.pending -= m9` fails on its own line with "Local.pending has no row m9 at this step."
- [[src/services.ts#serviceStateAt]] replays a table as `{ columns, rows }` and applies cell, add, and remove changes.
- [[src/viewer/ServiceStateBlock.tsx#mergeRows]] lines up the shown table with the one it is compared to: the step before, or Today in a diff. It marks changed cells and added or removed rows, and the card styles them by mode.
- [[src/viewer/ServiceStage.tsx#widestState]] reserves the most rows any step shows, each with every column's widest cell, so the card keeps one size while the reader steps. Cells wrap past 24 characters, and on narrow screens a card with a text or table shrinks to the column before it scrolls.

## Tests

In [[src/parseViewer.test.ts]]:

- Replaying a table gives the expected rows at every step, including a cell changed on a row added earlier in the same step.
- In a diff, a `-` row and a `+` row with the same name give each side its own cells, and a `-` removal leaves Proposed's row in place.
- Errors name the line: a row with the wrong number of cells, a duplicate row name, a change to a row removed in an earlier step, an unknown column, a table with no header, and `+=` on a key/value state.

Rendering: the existing Logging in diagram shows the same values, steps, and routes before and after. Its cards are about 8 px narrower: key/value rows used a negative margin written as `-var(…)`, which is invalid CSS, so they were inset 4 px on each side. Writing it as `calc(-1 * var(…))` makes rows line up with tables and lets ELK lay the cards out slightly tighter.

:::gallery side-by-side
![Logging in before](media/regressions/login-before.png)
![Logging in after](media/regressions/login-after.png)
:::

```changes
c379aba
src/services.ts
src/viewer/ServiceStateBlock.tsx
src/viewer/ServiceStage.tsx
src/parseViewer.test.ts
fixtures/services/README.md
fixtures/diagram-diffs/README.md

ignore:
README.md
guide.md
```
