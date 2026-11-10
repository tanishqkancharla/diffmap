# Code highlights and notes

Highlight lines with `{…}` after the language and title the block with `[…]`. Line notes highlight their snippet in blue; hover the highlight to read its note. Inline notes use a dotted underline. In call stacks, blue dots mark rows that link to source code.

```ts [src/request.ts] {2-3}
function requestHandler(record: RecordInput) {
  const error = validateInput(record);
  if (error) return error;
  return existingService(record);
}
// [!note L2 validateInput] Returns an error when `name` is blank, otherwise undefined.
// [!note L3] Early return, so storage never sees an invalid record.
```

A note can cover a line range. Symbol notes match the first occurrence per line: name-only notes apply fence-wide, while `L4 record` scopes the note to line 4 and `L2-L3 record` scopes it to a range.

```py
def save(record):
    if not record.name:
        raise ValueError("name must not be empty")
    storage.save(record)
    return record
# [!note L2-L3] Rejects blank names before anything touches storage.
# [!note record] The dict the client sent, unchanged.
# [!note L4 record] This is the record passed to storage.
```

Call stacks take the same title, highlights, and notes. Rows count from the first row:

```callstack [Parsing a call stack fence] {3-4}
 fence = parseFence(lang, source) [[src/parseFence.ts#parseFence]]
-└── return { kind: "callstack", lines: parseCallStack(source) }
+├── { code, notes } = parseCodeNotes(source) # split off trailing notes [[src/codeNotes.ts#parseCodeNotes]]
+├── lines = parseCallStack(code)
+└── return { kind: "callstack", lines, highlights, notes }
# [!note L3 parseCodeNotes] Removes note lines from the bottom of the fence.
# [!note L1] Click a linked row to open its source.
# [!note L5] `highlights` comes from md4x, which parses `{3-4}` in the info string.
```

Fences without highlights or notes render as before:

```sh
npx @tanishqkancharla/diffmap serve specs/<name>.md
```
