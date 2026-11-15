import assert from "node:assert/strict";
import test from "node:test";
import { composeStories } from "@storybook/react";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewView } from "./PreviewRoute.tsx";
import {
  fingerprint,
  isViewerOrigin,
  parseViewerMessage,
  resolveStories,
  storyInfo,
  type ComposeStories,
} from "./protocol.ts";

function Preferences({ name = "Weekly digest" }: { name?: string }) {
  return <p className="preferences">{name}</p>;
}

const preferencesStories = {
  default: {
    title: "Settings/Preferences",
    component: Preferences,
    decorators: [
      (Story: () => React.ReactNode) => (
        <main data-provider="">
          <Story />
        </main>
      ),
    ],
  },
  Editing: {},
  EmptyName: {
    args: { name: "" },
    parameters: {
      docs: { description: { story: "Saving waits for a name." } },
    },
    play: async () => {},
  },
};

const compose = composeStories as unknown as ComposeStories;

test("only the local viewer and diffmap.dev may drive the page", () => {
  assert.equal(isViewerOrigin("http://127.0.0.1:4310"), true);
  assert.equal(isViewerOrigin("http://localhost:5173"), true);
  assert.equal(isViewerOrigin("https://www.diffmap.dev"), true);
  assert.equal(isViewerOrigin("https://diffmap.dev.attacker.example"), false);
  assert.equal(isViewerOrigin("https://127.0.0.1:4310"), false);
  assert.equal(isViewerOrigin("http://127.0.0.1.attacker.example"), false);
  assert.equal(isViewerOrigin("null"), false);
});

test("the page accepts only well-formed viewer messages", () => {
  assert.deepEqual(parseViewerMessage({ type: "preview-connect" }), {
    type: "preview-connect",
  });
  assert.deepEqual(
    parseViewerMessage({ type: "preview-show", story: "a--b", how: "play" }),
    { type: "preview-show", story: "a--b", how: "play" },
  );
  assert.deepEqual(
    parseViewerMessage({ type: "preview-show", story: "a--b" }),
    {
      type: "preview-show",
      story: "a--b",
      how: "render",
    },
  );
  assert.deepEqual(
    parseViewerMessage({ type: "preview-mode", mode: "thumbnail" }),
    { type: "preview-mode", mode: "thumbnail" },
  );
  assert.deepEqual(
    parseViewerMessage({
      type: "preview-show",
      story: "a--c",
      how: "play",
      path: ["a--b", "a--c"],
    }),
    {
      type: "preview-show",
      story: "a--c",
      how: "play",
      path: ["a--b", "a--c"],
    },
  );
  for (const path of [[], ["a--c", "a--b"], ["a--b", 3], "a--c"])
    assert.deepEqual(
      parseViewerMessage({ type: "preview-show", story: "a--c", path }),
      { type: "preview-show", story: "a--c", how: "render" },
    );
  assert.equal(parseViewerMessage({ type: "preview-show" }), undefined);
  assert.equal(
    parseViewerMessage({ type: "preview-mode", mode: "x" }),
    undefined,
  );
  assert.equal(parseViewerMessage("preview-connect"), undefined);
});

test("a story's fingerprint changes with its markup", () => {
  assert.equal(fingerprint("<p>Saved</p>"), fingerprint("<p>Saved</p>"));
  assert.notEqual(
    fingerprint('<p class="a">Saved</p>'),
    fingerprint('<p class="b">Saved</p>'),
  );
  assert.match(fingerprint(""), /^[0-9a-f]{8}$/);
});

test("stories are composed with Storybook and listed by their Storybook IDs", () => {
  const catalog = resolveStories(
    { "./settings/Preferences.stories.tsx": preferencesStories },
    compose,
  );
  assert.deepEqual(catalog.problems, []);
  assert.deepEqual([...catalog.stories.values()].map(storyInfo), [
    {
      id: "settings-preferences--editing",
      title: "Settings/Preferences",
      name: "Editing",
      description: undefined,
      hasPlay: false,
    },
    {
      id: "settings-preferences--empty-name",
      title: "Settings/Preferences",
      name: "EmptyName",
      description: "Saving waits for a name.",
      hasPlay: true,
    },
  ]);
});

test("mistakes in story files are named", () => {
  const catalog = resolveStories(
    {
      "./Preferences.stories.tsx": preferencesStories,
      "./Copy.stories.tsx": preferencesStories,
      "./NoMeta.stories.tsx": { Primary: {} },
      "./NoTitle.stories.tsx": { default: { component: Preferences }, A: {} },
    },
    compose,
  );
  assert.deepEqual(catalog.problems, [
    './Copy.stories.tsx reuses the story ID "settings-preferences--editing".',
    './Copy.stories.tsx reuses the story ID "settings-preferences--empty-name".',
    "./NoMeta.stories.tsx has no default export with the story's meta.",
    "./NoTitle.stories.tsx needs a `title` in its meta, so its story IDs match Storybook's.",
  ]);
});

test("the page renders the story the URL names with its decorators, or says what is missing", () => {
  const catalog = resolveStories(
    { "./Preferences.stories.tsx": preferencesStories },
    compose,
  );
  const render = (storyId?: string) =>
    renderToStaticMarkup(<PreviewView catalog={catalog} storyId={storyId} />);
  assert.equal(
    render("settings-preferences--empty-name"),
    '<div data-preview-story="settings-preferences--empty-name" style="display:flow-root"><main data-provider=""><p class="preferences"></p></main></div>',
  );
  assert.match(render("settings-preferences--editing"), /Weekly digest/);
  assert.match(
    render("settings-preferences--gone"),
    /There is no story &quot;settings-preferences--gone&quot;/,
  );
  assert.match(
    render(),
    /Pick a story.*Settings\/Preferences.*href="\?story=settings-preferences--empty-name"/,
  );
});
