# Why each phase exists

Plans listed what each phase builds, but not the problem it solves. Tanishq had to ask for the reason, sometimes more than once.

## Evidence

- [Sync engine refactor on Gemini Neon](https://ampcode.com/threads/T-6c377553-0367-4c4c-bec2-5fdad76d559b) asked three times in a row:
  - Message 175: "why is phase 1 relevant to our plan? or is it just a DST fix?"
  - Message 179: "assume we're biased towards inaction - explain your motivation for each phase's change more clearly"
  - Message 181: "in each phase page, explain the problem we're solving." The agent then added a `## Problem` section to every phase.
- [Incremental pull responses](https://ampcode.com/threads/T-98c41648-d0a6-41d2-9cbb-2705d9b09b2f), message 408: "start by defining the constraints (what big O should we avoid/what can we hit)… work backwards to what the API needs to be… convince me your reasoning is correct."
- [Stateless server, sync engine split](https://ampcode.com/threads/T-01a18f6a-35c7-7034-93e2-0e9a5ee8509e), message 21: "get the ideal API from how it would be set up in different situations… and work backwards to architecture."
- [StyleX migration diffmap](https://ampcode.com/threads/T-01a1c3b4-c9a0-71e9-8e00-67a347867a7b), message 446: "give me the information i need to make an informed decision."

## Likely cause in the guide

Both planning intros ask for _what_, never _why_:

- The cover says "explain what is being built".
- The phase intro says "brief, simple explanation of how things work today and what is planned to change".

"Brief", together with the one-screen rule, also gives the agent a reason to cut motivation first. The other templates already have the missing piece: the explain-existing intro says "why it matters to the user", and the review intro says "what changed for the end user, and why".

## Proposed change

Reword both bullets under **Planning** in `guide.md`. Nothing is added:

```diff
-  - **Intro paragraphs:** explain what is being built, with visual mocks or media if possible, and high-level tradeoffs.
+  - **Intro paragraphs:** explain the problem and the constraints the design must meet, then what is being built, with visual mocks or media if possible, and high-level tradeoffs.
```

```diff
-  - **Intro:** brief, simple explanation of how things work today and what is planned to change.
+  - **Intro:** the problem this phase solves and why it comes now, then how things work today and what changes.
```

## Confidence

**High.** Tanishq gave this feedback three times in one thread, and in similar words in three other threads. The cause is easy to see in the text: one word, "what", in two bullets.
