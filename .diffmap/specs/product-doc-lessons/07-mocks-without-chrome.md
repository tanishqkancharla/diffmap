# Mocks without doc chrome

When an agent built a proposed UI for a product doc, it framed the mock like a document. It added headings, instructions, and demo controls inside the UI. Tanishq asked four times to strip them out.

## Evidence

[AI chat composer and send animation](https://ampcode.com/threads/T-d08a0409-84f6-42cf-9f39-d1d96362cf83) started from "create a productdoc with the ui changes" (message 1). The prototype had a header ("PROPOSED · ISOLATED MOTION STUDY"), a keyboard hint, and demo controls.

- Message 193: "remove the top heading, and the enter instructions, make it more realistic. add an empty state"
- Message 353: "remove the preview settings and the border, make it feel like a full app". The agent had first only moved the controls below the chat.
- Message 395: "remove title and description in empty state"
- Message 398: "remove html title"

## Likely cause in the guide

The top of `guide.md` says: "Label anything that is not built yet as proposed or illustrative." It doesn't say where the label goes. The prototype put "PROPOSED" in a header inside the UI, which follows that line literally. `guide/previews.md` already says to put the label "in each story's description". The general line is read first, though, and it reads as "label the thing itself".

## Proposed change

Reword the line in `guide.md` to say where labels go:

```diff
-A request to explain, plan, or review does not authorize implementing a proposal. Label anything that is not built yet as proposed or illustrative.
+A request to explain, plan, or review does not authorize implementing a proposal. Label anything that is not built yet as proposed in the page text or the story's description, never inside the mock UI.
```

## Confidence

**Medium-low.** Tanishq repeated the feedback four times, but all in one thread, and that thread built a standalone prototype page, not `preview` blocks. The "PROPOSED" header matches the line, but the headings and demo controls may have come from the agent's own habits.
