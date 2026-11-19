# Close the source panel on desktop

## Problem

Clicking a source reference in a Productdoc page opens the source panel beside the page. On a window wider than 900px, nothing on screen closes it again. The reader can only reload the page.

The panel has one close control, the **Collapse diff** button in its header, and its style hides it above 900px: [[6efed1a:src/viewer/SourceDiffPanel.tsx#L794-L803]]. On desktop the toolbar's **Diff** button used to close the panel instead. Commit `8f393f0` ("Hide Productdoc Diff control while preserving source navigation") now renders that button only on `diffmap.dev` and `www.diffmap.dev`: [[6efed1a:src/viewer/ViewerApp.tsx#L72-L75]]. Every other host, which is every Productdoc page, lost its desktop close control.

```ts [Who can close the panel today]
const showDiffButton = props.showDiffButton ?? isDiffmapHost(); // false on Productdoc
const toolbar = showDiffButton && hasSourceDiffs && <DiffButton onClick={toggle} />;
const collapseButton = <Button onPress={onClose} />; // CSS: display none above 900px

// Narrow window: collapseButton closes the panel.
// Desktop on diffmap.dev: DiffButton closes the panel.
// Desktop on any other host: nothing closes the panel.
```

## Solution

Show the **Diff** button on every host again by reverting `8f393f0`. On desktop the toolbar button closes the panel, as it did before that commit, and on narrow windows the panel's own chevron still works too. [Phase 1](01-restore-diff-button.md) has the change and the checks. [Phase 2](02-toc-reopen-squeeze.md) fixes a one-frame table of contents squeeze that reopening the panel exposed.

An earlier draft kept the button hidden and showed the panel's chevron at every width instead. Tanishq chose to bring the button back.

## Goals

- A reader can close the source panel at any width, on Productdoc and on `diffmap.dev`.
- Every host gets the same toolbar again, so there is no host check to keep in step.

## Non-goals

- Changing the panel's own chevron, which still shows only on narrow windows.
- Changing how references open the panel.
