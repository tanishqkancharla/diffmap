# Text and table state in service diagrams

A `services` fence gives every service a list of `state key = value` rows. That shape fits short values such as `generation = 2` or `cookie = sid=s_81f`. In the Halo and Tandem eval documents, agents also had to describe things that are not short values, and squeezed them into one anyway:

| What the agent meant          | What it wrote                                                                                                                     | Why it reads badly                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A rule about a value          | `Phone.send = reconciled when evidence permits, otherwise uncertain`                                                              | A sentence in a monospace cell. It says what _could_ happen, not what the phone holds now. |
| A record with several fields  | `state attempt = state plus verifier`                                                                                             | Two fields packed into one string; neither can change on its own.                          |
| A list whose rows come and go | `React.rows = completed todo removed`, `Local.pending = complete mutation`                                                        | The value narrates the change instead of showing the rows.                                 |
| A decision or permission      | `Release.permission = separately authorize or hold the iOS pilot`, `Owner.decision = explicitly authorize bounded pilot, or hold` | Lists the choices, so there is nothing to inspect. It belongs in a step.                   |

This is how the first, second, and fourth kinds render today. The card grows to fit each sentence, and nothing in it is a value you could check:

```services
service Phone "Halo iOS app"
  state send = reconciled when evidence permits, otherwise uncertain
  state attempt = state plus verifier
service Release
  state permission = separately authorize or hold the iOS pilot

start "Today: rules, records, and choices written as values"
  > Quoted from the Halo eval document. Step once to see a packed record change.
step "The phone retries the upload"
  Phone -> Release: upload(build 41)
  Phone.attempt = state and verifier held for one attempt
```

## Proposed

Keep `state key = value` for short values and add two shapes beside it. Tighten the guide so the rest go where they belong.

```text
service Build
  state generation = 2              %% key/value, unchanged
  text checks                       %% text: Markdown the service holds
    | - [x] Unit tests
    | - [ ] Acceptance on device
service Local "IndexedDB"
  table pending                     %% table: columns, one row per record
    | id | mutation        | status |
    | m1 | complete todo 3 | queued |

step "The sync worker sends m1"
  Local.pending[m1].status = sent          %% change one cell
  Local.pending += | m2 | delete todo 5 | queued |   %% add a row
  Build.checks =                           %% replace the text
    | - [x] Unit tests
    | - [x] Acceptance on device
step "The server confirms m1"
  Local.pending -= m1                      %% remove a row by its first column
```

- **Text** holds Markdown that a service keeps and can change per step: a checklist, a draft message, a plan. A text state that no step changes also works as a longer service description that stays visible, where the `>` tooltip is too small.
- **Table** holds records. Its first column names each row. A step can change one cell, add a row, or remove one. In a `services diff`, rows only Today has are red and rows only Proposed has are green, the way removed and added steps are colored.
- **The guide** says state is one current value you could inspect if you paused between steps. Rules go in `>` notes, decisions and permissions in step captions or notes.

**Goals**

- Each eval misuse above has a shape that reads well, shown on the phase pages.
- Existing `services` fences parse and render exactly as before.
- Text and table changes are highlighted in a step the same way key/value changes are, and `services diff` shows Today and Proposed for both.
- Cards stay readable at narrow widths and in dark mode.

**Non-goals**

- Changing a table's columns in a step, or different columns Today and Proposed.
- Markdown inside table cells; cells are plain text, monospace like key/value values.
- A line-by-line diff inside a text state. Changed text is shown whole.
- New ways to lay out or connect services.

## Built

All three phases are built in c379aba. The Halo record `attempt = state plus verifier` is now a table, and its rule is a note:

```services
service Phone "Halo iOS app"
  table attempts
    > One row per send the phone hasn't reconciled.
    | id | state     | verifier |
    | a1 | uncertain | v_19c    |
  text send
    | Uncertain until the server's **receipt** arrives.
service Server

start "The phone reconciles a send"
  > The record's fields change on their own, and the rule lives in text.
step "The server's receipt proves the send arrived"
  Server -> Phone: receipt(a1, v_19c)
  Phone.attempts[a1].state = reconciled
    > The receipt's verifier matches, so the phone trusts it.
  Phone.send = Reconciled.
```

## Phases

1. ✅ [State you could inspect](01-inspectable-state.md): the guide and README rule, with the Halo examples rewritten using only values.
2. ✅ [Text state](02-text-state.md): `text key` with `|` lines, its updates, and how it looks in a step and a diff.
3. ✅ [Table state](03-table-state.md): `table key` with rows, cell updates, `+=` and `-=`, and row colors in a diff.

✅ marks a phase that is built.

## Decisions made

- **Row identity is the first column.** No separate key syntax; `-=` and `[row]` name a row by its first cell, which must be unique.
- **`+=` and `-=`** add and remove rows. They read like code agents already write, and neither conflicts with a diff's sign column because they come after `Service.key`.
- **Changed text and table cells don't repeat their old version.** Key/value rows show the old value struck through; text can be a paragraph long and tables are already dense, so a changed text or cell is only highlighted. ← shows the step before.
- **Tables sit on an inset panel.** Titles use the card's description text, and the panel's columns line up with the card's keys. `+` and `−` mark rows only one side has, in diffs only.
- **A small Markdown subset in text.** Paragraphs, lists, checklists, bold, italic, and inline code. Cells in tables stay plain text.

## References

- Parser: [[src/services.ts#parseServiceDiagram]], state replay: [[src/services.ts#serviceStateAt]]
- Card rendering: [[src/viewer/ServiceStage.tsx#ServiceCard]], card widths: [[src/viewer/ServiceStage.tsx#widestState]]
- Fence docs: [[README.md#L403-L520]], guide paragraph: [[guide.md#L72]]
- Misuse examples: Halo and Tandem eval documents in the [skill-eval thread](https://ampcode.com/threads/T-8864e6c8-bfb3-47f6-8ed9-46a3dad3cab8)
