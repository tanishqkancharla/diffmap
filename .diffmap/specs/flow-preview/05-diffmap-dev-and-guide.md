# Phase 5: Flows on diffmap.dev, and the guide

[Phase 2](02-inline-widget.md) through [Phase 4](04-expanded-view.md) work in the local viewer. This phase shows flows on a pull request, and tells agents how to write them.

**Today**

On diffmap.dev, a spec can only show what is committed: text, diagrams, and screenshots.

**Proposed**

On diffmap.dev, the widget fills `preview` in `.diffmap/flows.json` from the pull request and loads the app's preview deployment in the iframe, so the reviewer gets the same live widget. `{branch}`, `{sha}`, and `{pull}` come from the pull request that [[src/github/fetchRepo.ts]] already reads for its head SHA. If the repo has no `preview` URL, or the deployment is not ready yet, the widget says so and links to running the spec locally.

[[guide.md]] gains a "Flows" section, linked from [Capture UI changes](../../../guide.md#capture-ui-changes):

- Use a `flow` fence when a phase changes a journey of several states or a branch, and screenshots when it changes one or two states.
- The first time, add the `/__flows` route inside the app's root providers and global styles, kept out of production, and write `.diffmap/flows.json`.
- Write each flow next to the code it shows, from the real components, with local fixtures and no requests. Keep flow-preview's rules on notes and on reaching a state through the controls a person would use.
- Open each state on its own, at `/__flows?flow=<id>&state=<id>`, and compare it with the running app before handing the spec back.

[[skills/generate-diffmap/SKILL.md]] adds "previewing a user flow" to its description, so agents pick it for the requests that used to trigger flow-preview. The flow-preview repo's README points to diffmap (a separate PR in that repo).

```changes

```
