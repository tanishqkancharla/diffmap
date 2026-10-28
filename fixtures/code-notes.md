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

Fences without highlights or notes render as before:

```sh
npx @tanishqkancharla/diffmap serve specs/<name>.md
```
