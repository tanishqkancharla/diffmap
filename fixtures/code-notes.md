# Code highlights and notes

Highlight lines with `{…}` after the language. Hover an underlined symbol or a line with a dot to read its note.

```ts {2-3}
function requestHandler(record: RecordInput) {
  const error = validateInput(record);
  if (error) return error;
  return existingService(record);
}
// [!note validateInput] Returns an error when `name` is blank, otherwise undefined.
// [!note L3] Early return, so storage never sees an invalid record.
```

A note can cover a line range, and a symbol note covers every occurrence:

```py
def save(record):
    if not record.name:
        raise ValueError("name must not be empty")
    storage.save(record)
    return record
# [!note L2-L3] Rejects blank names before anything touches storage.
# [!note record] The dict the client sent, unchanged.
```

Call stacks take the same highlights and notes. Rows count from the first row:

```callstack {3-4}
 fence = parseFence(lang, source) [[src/parseFence.ts#parseFence]]
-└── return { kind: "callstack", lines: parseCallStack(source) }
+├── { code, notes } = parseCodeNotes(source) # split off trailing notes [[src/codeNotes.ts#parseCodeNotes]]
+├── lines = parseCallStack(code)
+└── return { kind: "callstack", lines, highlights, notes }
# [!note parseCodeNotes] Removes note lines from the bottom of the fence.
# [!note L1] Click a linked row to open its source.
# [!note L5] `highlights` comes from md4x, which parses `{3-4}` in the info string.
```

Fences without highlights or notes render as before:

```sh
npx @tanishqkancharla/diffmap serve specs/<name>.md
```
