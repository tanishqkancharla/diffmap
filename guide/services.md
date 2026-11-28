# Service diagrams

A `services` block steps one message through several services and shows the state each step changes. Declare each service and its state, then add steps. Use `start "caption"` before the first step as the title of the whole diagram, with a `>` line under it summarizing the full process.

State is what you could inspect inside a service if you paused between steps: one current value, not a rule, a list of choices, or a permission. Put a rule in a `>` note on the update it explains, a decision or permission in the caption or note of the step where it happens, and a result passed back in a reply event. Choose the state shape that fits the data:

- `state key = value` for a short value (`Service.key = value` updates it).
- `text key` with indented `| ` Markdown lines under it for prose, a draft, or a checklist (`Service.key = text` or `Service.key =` with `| ` lines replaces it).
- `table key` with an indented `| col1 | col2 |` header and rows uniquely named by their first cell (`Service.key[row].col = value` changes a cell, `Service.key += | … |` adds a row, and `Service.key -= row` removes one).

Link a service to source with `[[path#symbol]]` after its name. Add `diff` after `services` to show a change, starting lines with `-` (before only), `+` (after only), or a space (both). Title a block with `[Title]` after the fence name. Show at most about 5 services in one view; collapse a service's sub-services into one box and explain its inside in a separate view.

````md
```services diff
 service Client "Client"
   state form = name empty
 service Handler "requestHandler" [[src/request.ts#requestHandler]]
 service Storage "Storage"
   state records = valid records
 start "Click Save with no name"
   > The handler now validates before saving.
 step "The handler receives the record"
   Client -> Handler: saveRecord({ name: "" })
-step "The record reaches storage"
   Handler -> Storage: save(record)
   Storage.records = includes a blank name
   Handler -> Client: { ok: true }
+step "Validation stops it first"
   Handler -> Client: { ok: false, error: "name must not be empty" }
   Client.form = shows the error under the name field
```
````
