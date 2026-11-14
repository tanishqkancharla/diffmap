import { composeStories } from "@storybook/react";
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
  parseViewerMessage,
  resolveStories,
  storyInfo,
  type CatalogStory,
  type ComposeStories,
  type PreviewRouteMessage,
  type StoryCatalog,
  type StoryModules,
} from "./protocol.js";

type Shown = { id: string; key: number };

/**
 * Renders the story named by `?story=` with Storybook's portable stories API, inside the app's own build.
 * The app applies its Storybook preview with `setProjectAnnotations` first, so decorators and providers wrap each story.
 * Framed by a diffmap viewer, it also answers the viewer's messages and reports each story it shows.
 */
export function PreviewRoute({ stories }: { stories: StoryModules }) {
  const catalog = useMemo(
    () => resolveStories(stories, composeStories as unknown as ComposeStories),
    [stories],
  );
  const [shown, setShown] = useState<Shown | undefined>(undefined);
  const [initialStory] = useState(
    () => new URLSearchParams(window.location.search).get("story") ?? undefined,
  );
  const [requested, setRequested] = useState(initialStory);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerOrigin = useRef<string | undefined>(undefined);
  const lastSize = useRef("");
  const lastState = useRef("");
  const showCount = useRef(0);

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
    if (shown === undefined || container === null) return;
    const state = {
      story: shown.id,
      fingerprint: fingerprint(container.innerHTML),
    };
    const key = `${state.story} ${state.fingerprint}`;
    if (key === lastState.current) return;
    lastState.current = key;
    post({ type: "preview-state", ...state });
  }, [post, shown]);

  const show = useCallback(
    async (id: string) => {
      const story = catalog.stories.get(id);
      if (story === undefined) {
        post({ type: "preview-error", message: `There is no story "${id}".` });
        return;
      }
      const count = ++showCount.current;
      try {
        await story.Story.load();
      } catch (error) {
        post({
          type: "preview-error",
          message: `Loading "${id}" failed: ${errorMessage(error)}`,
        });
        return;
      }
      if (count !== showCount.current) return;
      setShown({ id, key: count });
      const url = new URL(window.location.href);
      url.searchParams.set("story", id);
      window.history.replaceState(window.history.state, "", url);
    },
    [catalog, post],
  );

  useEffect(() => {
    if (initialStory !== undefined && catalog.stories.has(initialStory))
      void show(initialStory);
  }, [catalog, initialStory, show]);

  useEffect(() => {
    // Storybook runs a story's play function once it has rendered, so a story defined by interactions reaches its state.
    if (shown === undefined) return;
    const story = catalog.stories.get(shown.id);
    const container = containerRef.current;
    if (story === undefined || container === null) return;
    const observer = new ResizeObserver(reportSize);
    observer.observe(container);
    let current = true;
    const played = story.Story.play?.({ canvasElement: container });
    void Promise.resolve(played).then(
      () => {
        if (current) requestAnimationFrame(reportState);
      },
      (error: unknown) => {
        if (!current) return;
        post({
          type: "preview-error",
          message: `The play function of "${shown.id}" threw: ${errorMessage(error)}`,
        });
        requestAnimationFrame(reportState);
      },
    );
    return () => {
      current = false;
      observer.disconnect();
    };
  }, [catalog, post, reportSize, reportState, shown]);

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
      // Phase 4 runs "play" on the story already showing; until then both render the story.
      if (message.type === "preview-show") {
        setRequested(message.story);
        void show(message.story);
      } else document.documentElement.dataset.previewMode = message.mode;
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
      storyId={shown?.id ?? requested}
      renderKey={shown?.key}
      containerRef={containerRef}
    />
  );
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
