# Phase 6: Previews on diffmap.dev, and the guide

[Phase 2](02-preview-block.md) through [Phase 5](05-expanded-flow.md) work in the local viewer. This phase shows previews on a pull request, and tells agents how to write them.

**Today**

On diffmap.dev, a spec can only show what is committed: text, diagrams, and screenshots.

**Proposed**

On diffmap.dev, both blocks fill `previews.preview` in `.diffmap/config.json` from the pull request and load the app's preview deployment in their frames, so the reviewer gets the same live UI. `{branch}`, `{sha}`, and `{pull}` come from the pull request that [[src/github/fetchRepo.ts]] already reads for its head SHA. If the repo has no `previews.preview` URL, or the deployment is not ready yet, the block says so and links to running the spec locally.

[[guide.md]] gains a "Live previews" section, linked from [Capture UI changes](../../../guide.md#capture-ui-changes):

- Use a `preview` block for a component or design, a `flow` block for a journey of several states or a branch, and screenshots only for UI that has no story, such as a whole page that needs a backend.
- The first time, add the `/__previews` page with the project's Storybook preview applied, kept out of production, and add the `previews` key to `.diffmap/config.json`. If the app has no Storybook, install `@storybook/react` and `storybook` as dev dependencies; no Storybook server or config is needed.
- Reuse the team's stories where they exist. Write new ones next to the component, with a `title`, local fixtures, and no live requests.
- For a flow, write each child's `play` to start from what its parent shows, using the controls a person would use, and keep flow-preview's rules on notes, now each story's description.
- Open each story on its own, at `/__previews?story=<id>`, and compare it with the running app before handing the spec back.

[[skills/generate-diffmap/SKILL.md]] adds "previewing components and user flows" to its description, so agents pick it for the requests that used to trigger flow-preview. The flow-preview repo's README points to diffmap (a separate PR in that repo).

```changes

```
