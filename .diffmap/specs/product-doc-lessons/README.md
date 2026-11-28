# Product-doc lessons

These are changes to the Productdoc guide, drawn from Tanishq's threads over the last three to four weeks. Threads outside the diffmap repo count most: Tandem, Halo, Maui, and the Halo course. Eval runs are left out, and so are changes the evals already made to the guide (0.16.0 to 0.17.0).

Tanishq approved these recommendations except "Answer in the doc". That one was dropped, because chat stays the main way to work with the agent. The approved changes are applied to the guide as local, uncommitted edits. The skill stub is unchanged.

Each change starts from the guide wording that likely caused the behavior. It rewords or deletes that wording rather than adding a new rule that might conflict with it. Two tool ideas stay open:

- a `validate` warning for blocks that scroll
- showing a before screenshot and a live preview together in one block

## What kept going wrong

In most threads, Tanishq said little about how the doc looked. He did not complain about titles, galleries, or headings. His feedback was about what the doc said and whether it helped him decide:

- **Why are we doing this?** He asked for the reason behind each phase three times in one thread.
- **Where did my decision go?** Rewrites dropped choices he had already made.
- **Show me the real code.** He asked four times in one thread for plain client code with no extra library.
- **Show me the real UI.** A review of a visual change used cropped screenshots instead of live components.

## Changes

| Rank | Change                                                  | Confidence  |
| ---- | ------------------------------------------------------- | ----------- |
| 1    | [Explain why each phase exists](01-why-each-phase.md)   | High        |
| 2    | [Keep decisions in rewrites](02-keep-decisions.md)      | High        |
| 3    | [Show the developer's real code](03-real-code.md)       | High        |
| 4    | [Write for a cold reader](05-cold-reader.md)            | Medium-high |
| 5    | [Confirm scope on relayed briefs](06-relayed-briefs.md) | Medium      |
| 6    | [Mocks without doc chrome](07-mocks-without-chrome.md)  | Medium-low  |
| 7    | [Fit blocks to the column](08-fit-the-column.md)        | Medium      |
| 8    | [Live previews over screenshots](10-live-previews.md)   | High        |

The last page, [Small fixes](09-small-fixes.md), covers the page-URL reword, tool problems the guide can't fix, and feedback the guide already covers.

## How to read each page

Each page has four parts:

- **Evidence:** the threads, what happened, and short quotes from Tanishq.
- **Likely cause in the guide:** the existing wording that probably leads agents there.
- **Proposed change:** a `diff` that rewords or deletes that wording, now applied to the guide.
- **Confidence:** how sure I am that the behavior is real and that this wording causes it.
