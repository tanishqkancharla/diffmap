# Assistant message

Gallery: `/patterns/assistant-message`. Not on the `"maui"` barrel. Prefer this recipe; rebuild with barrel components. Package source: `"maui/src/patterns/AssistantMessage.tsx"` if you need a detail this file does not cover.

`AssistantMessage`: streaming **markdown reply**. Same reading scale as `Prose` (`proseHtml(size)`), column `proseContainerStyle`.

```tsx
<AssistantMessage size="sm" isAnimating={streaming}>
  {markdown}
</AssistantMessage>
```

Rebuild with Streamdown + Maui tokens (Streamdown is a Maui dependency):

1. Root: `style(proseContainerStyle, { minWidth: 0 })`. `aria-live="polite"` and `aria-busy` while `isAnimating`.
2. `<Streamdown>` with `proseHtml(size)` on the root (flex column, Maui type, **drop Streamdown’s Tailwind classNames** on `h1`/`p`/`ul`/… so markers and gaps stay under Maui).
3. Fenced code: while the fence is incomplete, render a plain `<pre>` (`radius.md`, `shadow.subtle`, `backgroundColor.app`, padding 12px) so the highlighter does not remount every chunk. When complete, `<CodeBlock lang={lang}>{text}</CodeBlock>`.
4. Animation: keep Streamdown `animated` **stably on**; toggle `isAnimating` only. Flipping `animated` resets stagger and makes new blocks pop. Word fade: `duration: motionStreamDurationMs`, `easing: motionEasing`, `stagger: 16`. While animating, also apply `proseStreamingMarkers` so list bullets fade with words.
5. `controls={false}`, `lineNumbers={false}`, `mode="streaming"`.

Do not wrap AssistantMessage in `Prose` — `proseHtml` already owns rhythm.

User turns in a chat are **not** this pattern: they are a right-aligned bubble (`prose("sm").paragraph`, `radius.md`, `shadow.subtle`, `background.element`, max-width ~80%). See [AI chat](../apps/ai-chat.md).
