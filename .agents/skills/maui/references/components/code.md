# Code

Gallery: `/components/code`. Import from `"maui"`.

```tsx
<Code>proseMaxWidth</Code>
<Kbd>⌘</Kbd><Kbd>K</Kbd>
<CodeBlock lang="ts">{`const n = 1`}</CodeBlock>
```

`CodeBlock` highlights with Shiki using the resolved theme. `lang` is required. Unsupported langs / pending highlight render a plain `<pre>`.
