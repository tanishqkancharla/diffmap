# Capture UI changes

When a phase changes a UI that has Storybook stories, or could have them, show it live instead: run `npx product-doc@latest guide previews`. Otherwise, capture the running app with the browser automation you have, such as Playwright or agent-browser, and add the captures to the phase. They let the reader judge the result without running it, and they test your work: before you add a capture, look at it with the expected result in mind, and fix what it shows wrong. Skip captures for changes nobody sees, such as a refactor or a backend fix with no visible effect.

- Use screenshots by default: they show how a state looks. Take one per state, variant, or window width the change affects, default first, such as empty, loading, error, hover, or a narrow window, and label each with the state it shows.
- Record a clip only for what screenshots cannot show: hover and click feedback, menus, focus, dragging, transitions, or timing. Move a real pointer through the whole interaction, past neighboring controls, and keep the clip under about 15 seconds.
- Show Today beside Proposed when the comparison is the point. Capture Today from the unchanged code, such as the base commit in a worktree, not from a mockup. When Proposed has a story, put the Today screenshot right above its live `preview` block; otherwise pair both captures in a `side-by-side` gallery. Use `grid` to scan several states or variants, and `carousel [Title]` to step through the stages of a flow:

  ```md
  :::gallery side-by-side
  ![Before](media/<page-slug>/save-before.png)
  ![After](media/<page-slug>/save-after.png)
  :::
  ```

- Keep only captures that help the reader decide something. Leave out intermediate attempts; when a fix changes the UI, replace the capture so only the final one remains.
- Crop screenshots to the part that changed, keep text readable, and leave out secrets and personal data.
- Save captures under `media/<phase-slug>/` in the spec and link them relative to the page, as in `media/write-through/save.png`. Prefer `.mp4` for recordings, since every browser plays it. Commit them with the spec so the pull request viewer shows them; ask the user before committing more than a few megabytes.
- Above each capture, say in a sentence what to look for. Readers comment by highlighting that sentence or a gallery label, and **Copy comments** brings their notes back to you.
- A capture shows what happened; it does not prove the behavior. Say which checks you ran.
- `share` fails on local media. To share a spec with captures, link them by https URL, or open the spec on its pull request.
