# Live previews

A `preview` or `flow` block runs the app's real components in the spec, from the app's own Storybook stories. Use a `preview` block for a component or a design, with its variants side by side. Use a `flow` block for a journey of several states, or one that branches. Keep screenshots for UI that has no story, such as a whole page that needs a real backend.

````text
```preview [The log-in screen]
auth-log-in--empty
auth-log-in--wrong-password
```

```flow [Logging in]
auth-log-in--empty
  auth-log-in--filled: Fill in email and password
    auth-log-in--signed-in: Log in
    auth-log-in--wrong-password: Log in with the wrong password
  auth-log-in--forgot: Click "Forgot password?"
```
````

Name stories by their Storybook ID. In a `flow`, the first line is the starting state, and each later story is indented two spaces under the state it follows, with the action that leads to it after a colon. List the happy path first: the block's next-step button follows a state's first child.

**Set up the app once.** Skip this if the repo's `.diffmap/config.json` already has `previews`.

1. If the app has no Storybook, add `@storybook/react` and `storybook` as dev dependencies; no Storybook server or config is needed. For screens that call the server, add `msw` and `msw-storybook-addon`, run `npx msw init public`, and add `mswLoader` to the preview's `loaders`.
2. Add a page that the dev server and preview deployments serve, and the production deployment leaves out. In a Vite app, it is a `previews.html` beside `index.html`, added to `build.rollupOptions.input` only when the build is not for production, such as when `VERCEL_ENV` is not `production`. It loads:

   ```tsx
   import { createRoot } from "react-dom/client";
   import { setProjectAnnotations } from "@storybook/react";
   import { PreviewRoute } from "product-doc/preview";
   import preview from "../../.storybook/preview";

   setProjectAnnotations([preview]);
   const stories = import.meta.glob("../**/*.stories.tsx", { eager: true });
   createRoot(document.getElementById("root")!).render(
     <PreviewRoute stories={stories} />,
   );
   ```

   In a Next.js app, it is `app/__previews/page.tsx`, which calls `notFound()` on the production deployment, such as when `VERCEL_ENV` is `production`, and otherwise renders a client component with the same `PreviewRoute`, passing the story modules imported by hand. Import the project's `.storybook/preview` when it exists, so every story gets the app's decorators, providers, and global styles.

3. Send `previewFrameAncestors`, from `product-doc/preview`, as the page's `Content-Security-Policy` header, so only the local viewer and diffmap.dev can frame it: from the dev server, as with Vite's `server.headers`, and from preview deployments, as with `headers` in `vercel.json` or `headers()` in `next.config`.
4. Add the page's URLs to `.diffmap/config.json` at the repo root. `local` is the page on the dev server. `preview` is the page on each pull request's preview deployment, with `{branch}`, `{sha}`, or `{pull}`; diffmap.dev fills them from the pull request, with `{branch}` lowercase and every run of characters other than letters and digits turned into `-`, as Vercel and Netlify put a branch in a hostname. The deployment must be public, or diffmap.dev shows that it can't reach it.

   ```json [.diffmap/config.json]
   {
     "previews": {
       "local": "http://localhost:5173/previews.html",
       "preview": "https://myapp-git-{branch}-myteam.vercel.app/previews.html"
     }
   }
   ```

   Add a `flows` key only to change a flow's defaults: `"transitions": "render"` draws each state from the start instead of playing the step on the live UI, and `"viewport": { "width": 1280, "height": 800 }` sets the size of the expanded flow.

**Choose the states from the real UI.** Read the component, the screens that use it, and how its state changes. Map where the person starts, what they do, and the success, loading, validation, failure, retry, and permission states that matter to the change. Don't invent screens to fill out a flow.

**Write the stories.**

- Reuse the team's stories where they exist. Write new ones next to the component, in Storybook's format, with a `title`.
- Render the real component, through its props and the story's fixtures. If it mixes server calls with rendering, propose pulling out a small presentational component; never keep a lookalike copy of the UI for previews.
- Answer every request from the story's `parameters.msw.handlers`, never a live backend: previews must not sign anyone in, charge a card, or change real data. Use fixed values, not timestamps or random content.
- In a flow, each story after the first is one step from the story it is indented under. Its `play` does what the person does next, through `canvas` and `userEvent`, and its handlers give the server's answer to that step. Don't repeat the parent's steps: diffmap plays the path for you.
- Reach each state through the controls a person uses: click the real buttons, type one keystroke at a time, open the real menu and pick its item. The app's own transitions, such as a menu opening or a validation message appearing, then play in the preview as they do in the app. Set state directly only when no control reaches it.
- Model events from outside the app, such as an email link or a provider's approval, as their own step with an action, not as buttons added to the UI.
- Write each story's `parameters.docs.description.story` as the state's note: what just happened, what is saved or still pending, and what the person can do next. Mark behavior that does not exist yet as proposed.

**Check before handing back.** With the app's dev server running, open each story on its own at `<previews.local>?story=<id>`, and each flow state at `?story=<id>&path=<ids from the start>`. Fix what the page lists as wrong with a story file. Then open the spec with `serve`, step through every state of each flow, and compare the states with the running app, in light and dark themes and at a narrow width. The blocks show live UI only while the dev server runs; on a pull request, they load its preview deployment.
