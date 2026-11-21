# Code and changes cards

Show enough code for a developer to see the inputs and the result. Highlight lines with `{2-3}` after the language, and title the block with `[Title]`. Explain lines at the bottom of the block:

- `// [!note L3 symbol] text` or `// [!note L3-L5 symbol] text` for a name on specific lines.
- `// [!note symbol] text` for a name across the whole block.
- `// [!note L3-L5] text` for a snippet.

````md
```ts {2-3} [Caller response]
const response = await client.saveRecord({ name: "" });
// before: { ok: true }
// after:  { ok: false, error: "name must not be empty" }
// [!note L3] The form can show this error beside the name field.
```
````

For a code or prose patch, use a `diff` fence.

A `changes` fence ends a page about committed work. Its first line is the commit SHA or `<base>..<head>` range. Then list the files a reviewer should read in order, entry point first and then down the layers. After `ignore:`, list mechanical files such as lockfiles, snapshots, fixtures, and generated code. Every changed file belongs in one list or the other. Leave the fence empty to show uncommitted changes.

````md
```changes
a1b2c3d
src/request.ts
src/validate.ts

ignore:
src/request.test.ts
```
````
