# Live previews over screenshots

For a visual change, Tanishq wants to look at the real UI in the doc and see the details. The latest typography doc used cropped screenshots instead.

## Evidence

[Line height and tracking](https://ampcode.com/threads/T-01a2146f-9b79-7143-92f6-3b36bd536513):

- The request (message 355) was "create a productdoc of the changes".
- The agent wrote a 4-page review doc, `unified-typography-prose`. Every visual is a `:::gallery side-by-side` of cropped PNGs. "Before" was captured from the base commit in a worktree, and "After" from the working tree. The doc has no `preview`, `flow`, or `html` blocks.
- It ran `guide`, `guide ui`, `guide code`, and `guide callstack`. It never ran `guide previews` and never checked whether stories could be set up.
- Its own check found the before image clipped, and the gallery still side by side at 390px.
- Its last message offered "Add live preview stories … instead of static captures", so it knew it had skipped them.
- Tanishq afterwards: "i would've wanted it to use the UI components or html preview so I could see the visual details instead of images."

## Likely cause in the guide

The agent followed the guide closely. The guide steers a review of a visual change toward screenshots in four places:

1. **The only before/after recipe is a screenshot recipe.** `guide/ui.md` says "Show Today beside Proposed … in a `side-by-side` gallery. Capture Today from the unchanged code, such as the base commit in a worktree". `guide/previews.md` has no way to show Today at all: a `preview` block renders only the current code. A review is about before and after, so the screenshot recipe wins.
2. **"No stories" is read as "use screenshots".** Maui has no Storybook. Three lines treat that as the condition for screenshots:
   - `guide.md`: "(or screenshots and recordings when stories are not practical)"
   - the topic list: "`guide ui`: screenshots, recordings, and galleries for UI that has no stories"
   - `guide/previews.md`: "Keep screenshots for UI that has no story"

   Only `guide/ui.md` says "or could have them", and the agent reached it already headed for screenshots.
3. **The review cover lists screenshots first:** "real screenshots, live `preview` / `flow` blocks, or code of the change".
4. **The `html` rule rules out a live typography sample.** "Use an `html` block only for a visual none of them can draw." A gallery can "draw" any screen, so `html` never qualifies, even when it is the only way to show both scales live.

## Proposed change

Rewordings in `guide.md`:

```diff
-  - **Before and after:** real screenshots, live `preview` / `flow` blocks, or code of the change, first thing on the page.
+  - **Before and after:** live `preview` / `flow` blocks, real screenshots, or code of the change, first thing on the page.
```

```diff
-When a person interacts with screens, show visual mocks with `preview` and `flow` blocks (or screenshots and recordings when stories are not practical).
+When a person interacts with screens, show them live with `preview` and `flow` blocks, setting up stories if the app has none.
```

```diff
-- `npx product-doc guide ui`: screenshots, recordings, and galleries for UI that has no stories.
+- `npx product-doc guide ui`: screenshots, recordings, and galleries, for the old side of a before-and-after and for UI that cannot run without a real backend.
```

```diff
-Use an `html` block only for a visual none of them can draw.
+Use an `html` block only for a visual none of them can show live.
```

In `guide/previews.md`:

```diff
-Keep screenshots for UI that has no story, such as a whole page that needs a real backend.
+Keep screenshots for UI that cannot run without a real backend.
```

**Decision:** Before is a screenshot from the base commit, and After is a live preview. That makes two more rewordings.

In `guide.md`, the review cover:

```diff
-  - **Before and after:** real screenshots, live `preview` / `flow` blocks, or code of the change, first thing on the page.
+  - **Before and after:** a screenshot of the old UI followed by a live `preview` / `flow` block of the new one, or code of the change, first thing on the page.
```

In `guide/ui.md`:

```diff
-- Show Today beside Proposed when the comparison is the point, in a `side-by-side` gallery. Capture Today from the unchanged code, such as the base commit in a worktree, not from a mockup.
+- Show Today beside Proposed when the comparison is the point. Capture Today from the unchanged code, such as the base commit in a worktree, not from a mockup. When Proposed has a story, put the Today screenshot right above its live `preview` block; otherwise pair both captures in a `side-by-side` gallery.
```

The topic-list line above keeps `guide ui` as the place agents learn to capture the Before side.

Today the screenshot sits above the preview block, not beside it. Putting them side by side would need a small viewer feature, such as a `preview` line that names a before image (`maui-prose--lg: media/prose/lg-before.png`). That isn't built.

## Confidence

**High** that this caused the screenshots: every choice the agent made matches the quoted lines.
