# Call stacks

A `callstack` block shows how one service turns one message into a result. Write each row as data flow, `result = function(inputs)`, with `return` rows where they matter. Nest calls with `├──` and `└──`. Link real functions to source with `[[path#symbol]]`; an unlinked helper reads as pseudocode. Explain a row with a `#` comment at its end.

To show a change, start rows with `-` (before only), `+` (after only), or a space (both). Highlight rows with `{3-4}` after `callstack`, and title the block with `[Title]`. Keep one stack to about 12 rows; split a deeper path into a second stack.

````md
```callstack [Save record]
 response = requestHandler(record) [[src/request.ts#requestHandler]]
-└── return existingService(record) [[src/service.ts#existingService]]
+├── error = validateInput(record) # reject empty names
+├── if error: return error
+└── return existingService(record) [[src/service.ts#existingService]]
```
````

Explain a symbol at the bottom of the block with `# [!note L3 symbol] text`, the same way code blocks do (`npx product-doc guide code`).
