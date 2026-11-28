# Confirm scope on relayed briefs

Most docs outside diffmap were started by a Space thread passing on Tanishq's request. The worker treated the brief as settled scope and skipped the alignment questions the guide asks for. The first draft then missed the reader or the angle.

## Evidence

- [Sync engine refactor](https://ampcode.com/threads/T-62cab775-8d57-4cf1-9c0c-58ef9f32eeb7) started from a relayed brief (message 1). The agent never asked an alignment question. Over six rounds the doc went from 17 pages to four short ones, then back to more detail. Each round ended "validated and ready."
- [Supabase–Tandem sync experience](https://ampcode.com/threads/T-e3cb6a4a-4f21-4414-ab48-62b836200410): the agent read "end user experience" as the app's users. Tanishq meant developers: "well explain client side UX, like the code" (message 14).
- [Stateless server, sync engine split](https://ampcode.com/threads/T-01a18f6a-35c7-7034-93e2-0e9a5ee8509e), message 19: "let's agree on API and general design first, echo the rough idea back to me first". The agent had already written an 8-phase spec.
- [Player hover tooltips](https://ampcode.com/threads/T-01a1d71a-e358-7788-ac76-f581c25e57c3), message 435: "i meant more like from a student's perspective, how is it to learn in this format". The review had been written from a designer's view.

## Likely cause in the guide

The alignment bullet ends: "Wait for answers **unless scope is already settled**." Every relayed brief looks settled to the worker, because it arrives as a written task. The exception swallows the rule.

## Proposed change

Delete the exception in `guide.md`:

```diff
-ask up to two alignment questions before you write, most important first. Wait for answers unless scope is already settled.
+ask up to two alignment questions before you write, most important first, and wait for the answers.
```

## Confidence

**Medium.** The cause is a clear match, and the change is a deletion. The cost is one more round trip in Space workflows, where the human is not in the worker thread and the question has to travel back up. It may be worth trying in one eval round with a relayed brief first.
