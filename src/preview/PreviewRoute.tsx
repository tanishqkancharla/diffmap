import { composeStories } from "@storybook/react";
import { userEvent, within } from "storybook/test";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  PREVIEW_PROTOCOL,
  errorMessage,
  fingerprint,
  isViewerOrigin,
  parsePath,
  parseViewerMessage,
  resolveStories,
  storyInfo,
  type CatalogStory,
  type ComposeStories,
  type PreviewRouteMessage,
  type StoryCatalog,
  type StoryModules,
} from "./protocol.js";

/** The first story of `path` is rendered; the play function of each story in it then runs in order. */
type Shown = { path: string[]; key: number };

/** In the live frame a step's typing and clicks are paced so a reader can follow them; replays and thumbnails run at once. */
const PACED_DELAY_MS = 35;

/**
 * Renders the story named by `?story=` with Storybook's portable stories API, inside the app's own build.
 * The app applies its Storybook preview with `setProjectAnnotations` first, so decorators and providers wrap each story.
 * Framed by a diffmap viewer, it also answers the viewer's messages and reports each story it shows.
 *
 * A flow state comes with its path, the stories from the flow's first story to it. Each story after the first is one step:
 * its play function starts from what the story before it shows. To reach a state the page renders the first story and
 * plays each step; to move to a child of the state it shows, it plays only the child's step on the UI already there.
 */
export function PreviewRoute({ stories }: { stories: StoryModules }) {
  const catalog = useMemo(
    () => resolveStories(stories, composeStories as unknown as ComposeStories),
    [stories],
  );
  const [initial] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const story = params.get("story") ?? undefined;
    if (story === undefined) return undefined;
    return parsePath(params.get("path")?.split(","), story) ?? [story];
  });
  const [requested, setRequested] = useState(initial?.at(-1));
  const [shown, setShown] = useState<Shown | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerOrigin = useRef<string | undefined>(undefined);
  const lastSize = useRef("");
  const lastState = useRef("");
  const runCount = useRef(0);
  /** The path the UI has reached, once every step of it played. */
  const reached = useRef<{ path: string[]; key: number } | undefined>(
    undefined,
  );
  const live = useRef(true);

  const post = useCallback((message: PreviewRouteMessage) => {
    if (viewerOrigin.current === undefined || window.parent === window) return;
    window.parent.postMessage(message, viewerOrigin.current);
  }, []);

  const reportSize = useCallback(() => {
    const container = containerRef.current;
    if (container === null) return;
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const size = `${width}x${height}`;
    if (size === lastSize.current) return;
    lastSize.current = size;
    post({ type: "preview-size", width, height });
  }, [post]);

  const reportState = useCallback(() => {
    const container = containerRef.current;
    const story = reached.current?.path.at(-1);
    if (story === undefined || container === null) return;
    const state = { story, fingerprint: fingerprint(container.innerHTML) };
    const key = `${state.story} ${state.fingerprint}`;
    if (key === lastState.current) return;
    lastState.current = key;
    post({ type: "preview-state", ...state });
  }, [post]);

  const playStep = useCallback(
    async (id: string, paced: boolean) => {
      const story = catalog.stories.get(id)!.Story;
      const container = containerRef.current;
      if (story.play === undefined || container === null) return;
      const play = () =>
        story.play!({
          canvasElement: container,
          canvas: within(container),
          // oxlint-disable-next-line unicorn/no-null -- user-event's own value for no delay.
          userEvent: userEvent.setup({ delay: paced ? PACED_DELAY_MS : null }),
        });
      await (paced ? play() : withoutScrollingToFocus(play));
    },
    [catalog],
  );

  const show = useCallback(
    async (path: string[], how: "render" | "play") => {
      const missing = path.find((id) => !catalog.stories.has(id));
      if (missing !== undefined) {
        post({
          type: "preview-error",
          message: `There is no story "${missing}".`,
        });
        return;
      }
      const count = ++runCount.current;
      const target = path.at(-1)!;
      const from = reached.current;
      if (
        how === "play" &&
        from !== undefined &&
        from.path.length === path.length - 1 &&
        from.path.every((id, index) => path[index] === id)
      ) {
        reached.current = undefined;
        try {
          await catalog.stories.get(target)!.Story.load();
          if (count !== runCount.current) return;
          await playStep(target, live.current);
          if (count !== runCount.current) return;
          reached.current = { path, key: from.key };
          setUrl(path);
          requestAnimationFrame(reportState);
          return;
        } catch (error) {
          post({
            type: "preview-error",
            message: `The step to "${target}" threw, so it was rendered from the start: ${errorMessage(error)}`,
          });
        }
      }
      try {
        await catalog.stories.get(path[0]!)!.Story.load();
      } catch (error) {
        post({
          type: "preview-error",
          message: `Loading "${path[0]}" failed: ${errorMessage(error)}`,
        });
        return;
      }
      if (count !== runCount.current) return;
      reached.current = undefined;
      setShown({ path, key: count });
      setUrl(path);
    },
    [catalog, playStep, post, reportState],
  );

  useEffect(() => {
    if (initial !== undefined && initial.every((id) => catalog.stories.has(id)))
      void show(initial, "render");
  }, [catalog, initial, show]);

  useEffect(() => {
    // Storybook runs a story's play function once it has rendered, so a story defined by interactions reaches its state.
    if (shown === undefined) return;
    const container = containerRef.current;
    if (container === null) return;
    const observer = new ResizeObserver(reportSize);
    observer.observe(container);
    let current = true;
    void (async () => {
      for (const [index, id] of shown.path.entries()) {
        if (!current) return;
        try {
          if (index > 0) await catalog.stories.get(id)!.Story.load();
          if (!current) return;
          await playStep(id, false);
        } catch (error) {
          if (!current) return;
          post({
            type: "preview-error",
            message: `The play function of "${id}" threw: ${errorMessage(error)}`,
          });
          break;
        }
      }
      if (!current) return;
      reached.current = { path: shown.path, key: shown.key };
      requestAnimationFrame(reportState);
    })();
    return () => {
      current = false;
      observer.disconnect();
    };
  }, [catalog, playStep, post, reportSize, reportState, shown]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || !isViewerOrigin(event.origin))
        return;
      const message = parseViewerMessage(event.data);
      if (message === undefined) return;
      if (message.type === "preview-connect") {
        viewerOrigin.current = event.origin;
        lastSize.current = "";
        lastState.current = "";
        post({
          type: "preview-ready",
          protocol: PREVIEW_PROTOCOL,
          stories: [...catalog.stories.values()].map(storyInfo),
        });
        if (requested !== undefined && !catalog.stories.has(requested))
          post({
            type: "preview-error",
            message: `There is no story "${requested}".`,
          });
        reportSize();
        reportState();
        return;
      }
      if (event.origin !== viewerOrigin.current) return;
      if (message.type === "preview-show") {
        setRequested(message.story);
        void show(message.path ?? [message.story], message.how);
      } else {
        live.current = message.mode === "live";
        document.documentElement.dataset.previewMode = message.mode;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [catalog, post, reportSize, reportState, requested, show]);

  useEffect(() => {
    // The viewer's preview-connect can arrive before React mounts the listener, so the page asks for it once it listens.
    // The hello goes to any parent because it carries nothing; the catalog only goes to a viewer origin that connects.
    if (window.parent !== window)
      window.parent.postMessage(
        {
          type: "preview-hello",
          protocol: PREVIEW_PROTOCOL,
        } satisfies PreviewRouteMessage,
        "*",
      );
  }, []);

  if (
    requested !== undefined &&
    shown === undefined &&
    catalog.stories.has(requested)
  )
    return undefined;
  return (
    <PreviewView
      catalog={catalog}
      storyId={shown?.path[0] ?? requested}
      renderKey={shown?.key}
      containerRef={containerRef}
    />
  );
}

function setUrl(path: string[]) {
  const url = new URL(window.location.href);
  url.searchParams.set("story", path.at(-1)!);
  if (path.length > 1) url.searchParams.set("path", path.join(","));
  else url.searchParams.delete("path");
  window.history.replaceState(window.history.state, "", url);
}

export function PreviewView({
  catalog,
  storyId,
  renderKey,
  containerRef,
}: {
  catalog: StoryCatalog;
  storyId: string | undefined;
  renderKey?: number;
  containerRef?: RefObject<HTMLDivElement | null>;
}) {
  if (catalog.problems.length > 0)
    return (
      <Notice title="Fix these story files">
        <ul>
          {catalog.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </Notice>
    );
  const story =
    storyId === undefined ? undefined : catalog.stories.get(storyId);
  if (story === undefined)
    return (
      <Notice
        title={
          storyId === undefined
            ? "Pick a story"
            : `There is no story "${storyId}".`
        }
      >
        <StoryIndex catalog={catalog} />
      </Notice>
    );
  const { Story } = story;
  return (
    <div
      key={renderKey}
      ref={containerRef}
      data-preview-story={story.id}
      style={{ display: "flow-root" }}
    >
      <Story />
    </div>
  );
}

function StoryIndex({ catalog }: { catalog: StoryCatalog }) {
  if (catalog.stories.size === 0)
    return <p>No stories yet. Add a *.stories.tsx file with a title.</p>;
  const byTitle = new Map<string, CatalogStory[]>();
  for (const story of catalog.stories.values())
    byTitle.set(story.title, [...(byTitle.get(story.title) ?? []), story]);
  return (
    <ul>
      {[...byTitle].map(([title, stories]) => (
        <li key={title}>
          {title}
          <ul>
            {stories.map((story) => (
              <li key={story.id}>
                <a href={`?${new URLSearchParams({ story: story.id })}`}>
                  {story.name}
                </a>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

const noticeStyle: CSSProperties = {
  margin: 16,
  padding: 16,
  border: "1px solid currentColor",
  borderRadius: 8,
  font: "14px/1.5 system-ui, sans-serif",
};

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="alert" data-preview-notice="" style={noticeStyle}>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

/** Replaying steps focuses inputs, and focusing inside a frame scrolls the viewer to it; an instant replay is not something the reader asked to watch. */
async function withoutScrollingToFocus(run: () => Promise<unknown>) {
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (options?: FocusOptions) {
    focus.call(this, { ...options, preventScroll: true });
  };
  try {
    await run();
  } finally {
    HTMLElement.prototype.focus = focus;
  }
}
