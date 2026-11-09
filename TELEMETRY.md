# Telemetry

The diffmap CLI sends anonymous usage events to [PostHog](https://posthog.com) so we can see which commands and viewer features people use and where they run into problems. This file lists everything it sends. Turn it off with `DIFFMAP_TELEMETRY=0` (or `false`) or `DO_NOT_TRACK=1`; it is also off when `CI` is set.

Events never include file paths, spec contents, comment text, copied text, error messages, or anything else from your repository. Specs shared on diffmap.dev send nothing to PostHog.

## Every event

| Property      | Value                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `distinct_id` | A random ID stored in `~/.config/diffmap/telemetry-id` (or under `$XDG_CONFIG_HOME`)                                                                                                                                      |
| `version`     | The diffmap version                                                                                                                                                                                                       |
| `os`, `arch`  | Your OS and CPU architecture                                                                                                                                                                                              |
| `node`        | The Node version                                                                                                                                                                                                          |
| `invoked_by`  | The coding agent that ran the command: `amp`, `claude-code`, `codex`, `cursor`, `gemini-cli`, `opencode`, `other-agent`, `terminal`, or `unknown`. Read from variables such as `CLAUDECODE`; their values are never sent. |

## CLI events

| Event          | When                          | Properties                                                                                                                                                                     |
| -------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `command_run`  | Any command runs              | `command`: `serve`, `validate`, `share`, `guide`, `list`, or `update`                                                                                                          |
| `serve_result` | `serve` has started or failed | `ok`; on failure, `error`: the error's type, such as `DiffmapFileError`; on success, `references` and `fence_<kind>` (such as `fence_mermaid`): how many of each the spec uses |

## Viewer events

While `serve` runs, the local viewer reports these to its own `serve` process, which sends them with the CLI's ID and opt-outs. The page itself contacts no other site, and `serve` drops any event or value not listed here.

| Event              | When                                                                          | Properties                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `viewer_opened`    | The page first loads (reloads after edits are not counted)                    | `seconds_after_serve`                                                                                        |
| `viewer_engaged`   | Once per page load: visible for 30 s in total, or scrolled past half the spec | `trigger`: `time` or `scroll`                                                                                |
| `comment_added`    | A comment is saved                                                            | `target`: `text` (prose) or `lines` (code)                                                                   |
| `comments_copied`  | Copy comments is pressed                                                      |                                                                                                              |
| `code_copied`      | A code block's Copy is pressed                                                |                                                                                                              |
| `diff_opened`      | The Diff panel opens                                                          |                                                                                                              |
| `reference_opened` | A code reference or annotation in the spec is clicked                         |                                                                                                              |
| `file_reviewed`    | A file is marked reviewed in the Diff panel                                   |                                                                                                              |
| `range_changed`    | The Diff panel switches to other commits                                      |                                                                                                              |
| `diagram_used`     | A service diagram is played, or a Mermaid diagram opens full screen           | `action`: `play` or `fullscreen`                                                                             |
| `viewer_error`     | Something fails to load                                                       | `kind`: `document` (the spec stopped parsing), `source` (a reference was not found), `excerpt`, or `changes` |
| `server_closed`    | Close server is pressed                                                       |                                                                                                              |

The CLI events are sent from [`src/telemetry.ts`](src/telemetry.ts) and [`src/cli.ts`](src/cli.ts); the viewer events are listed in `viewerEventSchema` in [`src/serve.ts`](src/serve.ts).
