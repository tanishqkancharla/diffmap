# Keep decisions in rewrites

When agents shortened or restructured a doc, they often dropped things Tanishq had already decided. The doc swung from too long to too thin.

## Evidence

- [Sync engine refactor on Gemini Neon](https://ampcode.com/threads/T-6c377553-0367-4c4c-bec2-5fdad76d559b):
  - Message 98: "what I feel like you're missing a lot from the previous plan about how to refactor the sync engine into backend and sync engine. what happened to that". The agent replied: "I dropped it, and that was a mistake."
  - Message 144: "where in the plan are we making the backend stateless?" He had asked for this in messages 102 and 106.
- [Sync engine refactor](https://ampcode.com/threads/T-62cab775-8d57-4cf1-9c0c-58ef9f32eeb7):
  - Message 74: "simplify the product doc, it's long and complicated right now, just focus on what's planned to be built". The agent cut 17 pages to about 965 words.
  - Message 114: "this feels like it's way too concise and lacking quite a bit of detail. what are we actually building here"
  - Message 132: "i'm still so lost."
- [StyleX migration diffmap](https://ampcode.com/threads/T-01a1c3b4-c9a0-71e9-8e00-67a347867a7b): the rewrite cut 4,612 words to about 1,600 (message 353). Later, message 476 asked: "explain in more detail the stylex pros."
- [Incremental pull responses](https://ampcode.com/threads/T-98c41648-d0a6-41d2-9cbb-2705d9b09b2f), message 394: "it seems like you're adding permissions into this which i want to remove". The agent said it "was extra scope I introduced."

## Likely cause in the guide

The thesis bullet says: "revise the existing sections and visuals **around the core thesis** instead of tacking on extra sections." Read with the one-screen rule, this tells the agent that a rewrite means trimming toward one idea. Anything that doesn't fit the thesis, such as the backend split, looks safe to cut. Nothing in the bullet says what a rewrite must keep.

The swing to "too concise" also came from Tanishq's own "simplify" (message 74), so the guide is only part of the cause.

## Proposed change

Reword the thesis bullet in `guide.md`:

```diff
-- **Keep one clear thesis.** When the user asks a question or gives feedback, revise the existing sections and visuals around the core thesis instead of tacking on extra sections.
+- **Keep one clear thesis.** When the user asks a question or gives feedback, revise the existing sections and visuals instead of tacking on extra sections. Keep every decision the user has made; cut detail only from what is not being built.
```

## Confidence

**High** that the behavior is real: it came up in three of the four planning threads outside diffmap. **Medium** that this wording caused it, because the user's own "simplify" requests did too.
