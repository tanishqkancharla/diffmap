# Fit blocks to the column

Tanishq gave no feedback on this. But agents in four threads spent many turns fixing diagrams and code that were too wide for the page, and `validate` passed every time.

## Evidence

- [Sync engine refactor on Gemini](https://ampcode.com/threads/T-01a201ef-d90b-771a-8843-300bc7da92f5), messages 54 to 75: a 6-box `services` diagram showed "Scroll horizontally to see all services." The agent took three rounds to merge boxes and shorten labels until it fit.
- [Sync engine refactor on Gemini Neon](https://ampcode.com/threads/T-6c377553-0367-4c4c-bec2-5fdad76d559b), messages 53 to 57, 90 to 92, and 124 to 129: call-stack and code lines were clipped on the right. Shortening the lines shifted the `[!note Lx]` line numbers, which then had to be recounted.
- [Expo mobile app diffmap](https://ampcode.com/threads/T-01a1d108-318c-7135-b01e-dd01d87b415c), messages 95 to 107 and 300 to 322: edge labels and call-stack rows were cut off.
- [Halo memory CLI](https://ampcode.com/threads/T-01a15767-f09f-72c3-9223-143ff0f0dffe): "Left-to-right layouts rendered too small to read", so the agent switched to top-down.

## Likely cause in the guide

Two pieces of guide text set the agents up:

- `guide.md` and `guide/services.md` both allow "at most about 7 services in one view". Agents stayed under that limit, and six boxes still scrolled.
- The only flowchart example in `guide/mermaid.md` uses `flowchart LR`. Agents copy the example's direction for flows of any size.

The clipped call-stack and code lines have no cause in the guide. Nothing in the guide talks about line length.

## Proposed change

Change the number in both places, and flip the example's direction. Nothing is added:

```diff
-Show at most about 7 services in one view;
+Show at most about 5 services in one view;
```

In the `guide/mermaid.md` example:

```diff
- flowchart LR
+ flowchart TD
```

For clipped lines, change the tool, not the guide: `validate` could warn when a code or call-stack line, or a diagram, will scroll.

## Confidence

**Medium.** The 5 comes from what agents saw at roughly six boxes. Check it against the viewer's column width before changing the number. The `LR` → `TD` change is low-risk.
