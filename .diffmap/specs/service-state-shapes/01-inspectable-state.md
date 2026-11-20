# ✅ Phase 1: State you could inspect

The [cover](README.md) lists four ways agents misused `state key = value`. Two of them, rules and decisions, need no new syntax: they are not state. This phase says so in the guide and the README.

**Today**

The guide says state is "what you would find inside a service if you paused between steps", but not where the rest goes. Agents then write the rule or the choice as a value, such as `Release.permission = separately authorize or hold the iOS pilot`.

**Proposed**

State holds one current value. A rule about how a value changes goes in a `>` note on the update. A decision or permission is something that happens, so it is a step: its caption says who decided what, and the state holds the result, such as `pilot = held`.

## Guide

This edits the services paragraph under **Shape → Visuals** in [[c379aba:guide.md#L72]], starting from origin/main's wording. The paragraph's last two sentences stay as they are.

```diff
-Use `services` when the parts keep state, run at the same time, or fan out; use a call stack when they are function calls that return, branch, or return early. In a `services` diagram, state is what you would find inside a service if you paused between steps; a result passed back is a reply event, not state. To explain a step, put a `>` note under its event, its update, or a service name on its own line.
+Use `services` when the parts keep state, run at the same time, or fan out; use a call stack when they are function calls that return, branch, or return early. In a `services` diagram, state is what you could inspect inside a service if you paused between steps: one current value, not a rule, a list of choices, or a permission. Put a rule in a `>` note on the update it explains, a decision or permission in the caption or note of the step where it happens, and a result passed back in a reply event. Use `state key = value` for a short value, `text` for prose or a checklist the service holds, and `table` for records, one row each. To explain a step, put a `>` note under its event, its update, or a service name on its own line.
```

This is the wording now in `guide.md`; `npm run cli -- guide` prints it.

## README

Under **Animated service diagrams**, the `state` bullet gains the same rule. The last three lines are new:

```md
- `state <key> = <value>` declares a value and its initial state. Indent it under
  its service. State is what you could inspect if you paused between steps, so
  give it one current value. A rule about how it changes goes in a `>` note, and
  a decision or permission goes in the step where it happens.
```

## The Halo examples, rewritten

The same story as the cover's Today diagram, in today's syntax. The rule became a note, the choice became a step, and each value is one word you could check. The packed `attempt` record is a table on the [cover](README.md).

```services
service Phone "Halo iOS app"
  state send = pending
    > uncertain until the server's receipt arrives, then reconciled.
service Server
service Release
  state pilot = held
    > Whether the iOS pilot may ship: held or authorized.

start "A message is reconciled, then the owner authorizes the pilot"
  > The phone keeps a send uncertain until the server proves it arrived. Shipping the pilot is a separate decision.
step "The phone sends without a receipt"
  Phone -> Server: send(m1)
  Phone.send = uncertain
    > No receipt yet, so the phone can't tell whether the server stored it.
step "The server's receipt reconciles the send"
  Server -> Phone: receipt(m1)
  Phone.send = reconciled
step "The owner authorizes a bounded pilot"
  > This is the decision the eval wrote as `permission = separately authorize or hold`.
  Release.pilot = authorized
```

## Verification

- `npm run cli -- guide` prints the new paragraph.
- The rewritten diagram above uses only key/value state, so the advice works without Phases 2 and 3.

```changes
c379aba
guide.md
README.md

ignore:
fixtures/diagram-diffs/README.md
fixtures/services/README.md
src/parseViewer.test.ts
src/services.ts
src/viewer/ServiceStage.tsx
src/viewer/ServiceStateBlock.tsx
```
