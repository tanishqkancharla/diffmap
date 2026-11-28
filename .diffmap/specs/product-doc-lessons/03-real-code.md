# Show the developer's real code

When the end user is a developer, Tanishq wanted to see the code they would actually write. Agents kept inventing helpers or adding libraries he didn't ask for.

## Evidence

- [Sync engine refactor](https://ampcode.com/threads/T-62cab775-8d57-4cf1-9c0c-58ef9f32eeb7):
  - Message 116: "the end user here is the user of the library and i want to see it from their experienc"
  - Message 132: "for each of the phase goals, add code/pseudocode for a test that would follow what the goal looks like."
  - Message 172: "we use gatekeeper for tests, can you rebuild on those abstractions". The agent had made up helpers such as `startTwoBackends` instead of using the repo's own test harness.
  - Message 183: "make the tests as human readable as possibel"
- [Supabase–Tandem sync experience](https://ampcode.com/threads/T-e3cb6a4a-4f21-4414-ab48-62b836200410) took four redirects to reach the right code:
  - Message 14: "well explain client side UX, like the code"
  - Message 19: "no don't use tanstack query show me what it looks like to use supabase client sdk + supabase vs. tandem client sdk + tandem"
  - Message 21: "show with react"
  - Message 46: "add in neon too". Neon was named in his first message, but the first draft left it out.
- [Incremental pull responses](https://ampcode.com/threads/T-98c41648-d0a6-41d2-9cbb-2705d9b09b2f), message 291: "explain what your proposed APIs are with comments about what they do. walk through a push/pull"

## Likely cause in the guide

Two lines leave room for invented code:

- The Phase goals bullet ends: "Use pseudocode when the real interface does not exist yet." To an agent, pseudocode allows helpers that don't exist, such as `startTwoBackends`, even when the repo has a test harness to write against.
- The comparison line says "show each option's flows side by side". It doesn't say which options, or that each must be written the same way. Neon was left out, and TanStack Query was added to make Supabase look less verbose.

## Proposed change

Reword both lines in `guide.md`. Nothing is added:

```diff
-Use pseudocode when the real interface does not exist yet.
+When the real interface does not exist yet, write the proposed calls in the style of the repo's existing code and tests.
```

```diff
-If the user is comparing options, show each option's flows side by side on the same page.
+If the user is comparing options, show every option they named side by side on the same page, each written the same way.
```

## Confidence

**High** for the comparison line: Tanishq redirected four times in one thread. **Medium** for the pseudocode line: one thread shows it, but the invented helpers match the wording closely.
