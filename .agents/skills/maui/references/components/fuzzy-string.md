# FuzzyString

Gallery: `/components/fuzzy-string`. Import from `"maui"`. Search UI example: [Calendar](../apps/calendar.md).

Renders highlight segments. **Not a plain string.**

```tsx
type FuzzyMatch = Array<{ match: string } | { skip: string }>;

<FuzzyString match={[{ skip: "Em" }, { match: "ail" }, { skip: " client" }]} />;
```

Matched spans use `accent[11]`. The matcher is **not** on the package barrel — build `{ match | skip }[]` in the app (first matching subsequence is enough). Drop items that do not match; sort by a score if you have one.
