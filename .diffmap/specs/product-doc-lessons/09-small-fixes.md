# Small fixes

These are lower-priority items: a one-line reword, tool problems the guide can't fix, and feedback the guide already covers.

## One-line reword

- **Page URLs drop the number.** In two threads, agents opened `/03-phase-1-durable-acks` and got "Page not found". The page is served at `/phase-1-durable-acks` ([Gemini Neon](https://ampcode.com/threads/T-6c377553-0367-4c4c-bec2-5fdad76d559b) message 39, [Gemini](https://ampcode.com/threads/T-01a201ef-d90b-771a-8843-300bc7da92f5) messages 50 to 54).
  - The cause is the file-tree comment `two-digit number sets order; slug is its URL`, which reads as if the whole file name is the slug.
  - Reword it to `number sets order; the name after it is the URL`.
  - Confidence: high that it saves turns, low impact.

## Not proposed, because it would add text

- **File layouts as trees.** In [Expo mobile app diffmap](https://ampcode.com/threads/T-01a1d108-318c-7135-b01e-dd01d87b415c), message 266: "file hierarchy using code blocks too". Message 673 asked again. No guide wording causes the gap, so the fix would be a new line. It came from one thread only.

## Tool problems, not guide problems

- `validate` reported `valid: true` in every thread, even when blocks rendered blank, overflowed, or were clipped. Every render problem was found by screenshots. See [Fit blocks to the column](08-fit-the-column.md).
- A Mermaid diff that declared the same node ID on both the before and after sides drew a stray "B" node ([Gemini Neon](https://ampcode.com/threads/T-6c377553-0367-4c4c-bec2-5fdad76d559b) messages 43 to 45).
- In [Color guidance audit](https://ampcode.com/threads/T-01a1d1ab-65a7-7663-8dc6-7f39093a90fc) (messages 123 to 135), a plain `diff` fence rendered empty until the agent added `---`, `+++`, and `@@` headers. That was on an older diffmap. It no longer happens on 0.17.0: the `diff` fences in this document have no headers, and they render their red and green lines.

## Already covered by the guide

The guide already handles this repeated feedback, so it needs no change:

- **More diagrams, less prose.** [Expo](https://ampcode.com/threads/T-01a1d108-318c-7135-b01e-dd01d87b415c) messages 51 and 266, [Incremental pull](https://ampcode.com/threads/T-98c41648-d0a6-41d2-9cbb-2705d9b09b2f) message 363, and [StyleX](https://ampcode.com/threads/T-01a1c3b4-c9a0-71e9-8e00-67a347867a7b) message 323. Covered by "Make the document visual first."
- **Call stacks as data flow** (`a = fn(b)`). [Incremental pull](https://ampcode.com/threads/T-98c41648-d0a6-41d2-9cbb-2705d9b09b2f) messages 540 and 569. Covered in `guide callstack`.
- **One page per phase, pages readable on their own.** [Diffmap multi-page books](https://ampcode.com/threads/T-88f4cac8-5a2f-477f-b014-cde71f241dc5). Covered by the spec layout.
- **Commit each phase and pin its changes card.** [Halo memory CLI](https://ampcode.com/threads/T-01a15767-f09f-72c3-9223-143ff0f0dffe) message 365, and [Gemini Neon](https://ampcode.com/threads/T-6c377553-0367-4c4c-bec2-5fdad76d559b) message 441. Covered by **Committed work**.
- **Use the latest guide.** [Halo memory CLI](https://ampcode.com/threads/T-01a15767-f09f-72c3-9223-143ff0f0dffe) message 265, and [Tandem poke filtering](https://ampcode.com/threads/T-563f72ee-ebf9-4600-8458-71379e4fcd17) message 371. The skill is now a stub that runs `npx product-doc guide`, so this is fixed.
