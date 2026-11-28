# Write for a cold reader

Docs and summaries were written from inside the agent's own research. Tanishq had only seen his own messages, so names and terms from that research lost him.

## Evidence

- [Incremental pull responses](https://ampcode.com/threads/T-98c41648-d0a6-41d2-9cbb-2705d9b09b2f), said twice:
  - Message 142: "make this easy for me to review. assume I haven't read through all of your thinking and work, and I only have the context of the user messages I've given you"
  - Message 408: "assume I haven't read your tool calls or intermediate reasoning"
  - Message 428: "put the definitions in this table as well in each row, so i don't have to keep going back and forth between other table"
- [Tandem poke filtering history](https://ampcode.com/threads/T-563f72ee-ebf9-4600-8458-71379e4fcd17), message 347: "wdym we're running a new simulation". The agent's term "a second simulation" was never defined.
- [Sync engine refactor on Gemini Neon](https://ampcode.com/threads/T-6c377553-0367-4c4c-bec2-5fdad76d559b), message 74: "i don't really understand the other options/how they're relevant". The agent then deleted that page.
- [Line height and tracking](https://ampcode.com/threads/T-01a2146f-9b79-7143-92f6-3b36bd536513), message 165: "I'm confused… why is this complicated". The preview compared two type scales from the code's history, not the one change he had in mind.

## Likely cause in the guide

The writing bullet is only about sentence form: "Write in full, simple sentences. Explain what happens and why in clear, complete sentences." The agents' sentences were clear. The problem was context the reader never saw. No line in the guide names who the reader is, so agents write for themselves.

## Proposed change

Reword the writing bullet in `guide.md` to name the reader. It stays one bullet:

```diff
-- **Write in full, simple sentences.** Explain what happens and why in clear, complete sentences.
+- **Write for a reader who has seen only their own messages.** Explain what happens and why in full, simple sentences, and define each term where you first use it.
```

## Confidence

**Medium-high.** Tanishq said it in almost the same words twice, and three other threads show the same confusion. The reword keeps the bullet's length about the same.
