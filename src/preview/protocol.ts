import type { ComponentType } from "react";

export const PREVIEW_PROTOCOL = 1;

/** A story as the page sends it to the viewer. */
export type PreviewStoryInfo = {
  id: string;
  title: string;
  name: string;
  /** The story's `parameters.docs.description.story`, which Storybook's docs also show. */
  description?: string;
  hasPlay: boolean;
};

export type PreviewRouteMessage =
  | { type: "preview-hello"; protocol: typeof PREVIEW_PROTOCOL }
  | {
      type: "preview-ready";
      protocol: typeof PREVIEW_PROTOCOL;
      stories: PreviewStoryInfo[];
    }
  | { type: "preview-size"; width: number; height: number }
  | { type: "preview-state"; story: string; fingerprint: string }
  | { type: "preview-error"; message: string };

export type PreviewViewerMessage =
  | { type: "preview-connect" }
  | {
      type: "preview-show";
      story: string;
      how: "render" | "play";
      /** A flow state's stories from the flow's first story to `story`; see PreviewRoute. */
      path?: string[];
    }
  | { type: "preview-mode"; mode: "live" | "thumbnail" };

/** The pages that may frame the page: the local viewer, which listens on any port, and diffmap.dev. */
export function isViewerOrigin(origin: string) {
  if (origin === "https://www.diffmap.dev") return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return (
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost")
  );
}

/** The `Content-Security-Policy` the page should be served with, so only the viewer can frame it. */
export const previewFrameAncestors =
  "frame-ancestors 'self' http://127.0.0.1:* http://localhost:* https://www.diffmap.dev";

export function parseViewerMessage(
  data: unknown,
): PreviewViewerMessage | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const message = data as Record<string, unknown>;
  switch (message.type) {
    case "preview-connect":
      return { type: "preview-connect" };
    case "preview-show": {
      if (typeof message.story !== "string") return undefined;
      const path = parsePath(message.path, message.story);
      return {
        type: "preview-show",
        story: message.story,
        how: message.how === "play" ? "play" : "render",
        ...(path === undefined ? {} : { path }),
      };
    }
    case "preview-mode":
      if (message.mode !== "live" && message.mode !== "thumbnail")
        return undefined;
      return { type: "preview-mode", mode: message.mode };
    default:
      return undefined;
  }
}

/** A path is kept only when it is a list of story IDs that ends at `story`. */
export function parsePath(value: unknown, story: string) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((id) => typeof id === "string") ||
    value.at(-1) !== story
  )
    return undefined;
  return value as string[];
}

/** FNV-1a of the story's rendered HTML: it changes when the markup or its classes do, so review marks can tell a story changed. */
export function fingerprint(html: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < html.length; index++) {
    hash ^= html.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** The parts of a story composed by Storybook's `composeStories` that the page uses. */
export type ComposedPreviewStory = ComponentType & {
  id: string;
  storyName: string;
  parameters: Record<string, unknown>;
  load: () => Promise<void>;
  /** Storybook's composed play merges the context it is given, so the page supplies `canvas` and a paced `userEvent`. */
  play?: (context: {
    canvasElement: HTMLElement;
    canvas?: unknown;
    userEvent?: unknown;
  }) => Promise<void>;
};

export type CatalogStory = PreviewStoryInfo & { Story: ComposedPreviewStory };

export type StoryCatalog = {
  stories: Map<string, CatalogStory>;
  /** Mistakes in the story files, shown in place of any story so the agent fixes them first. */
  problems: string[];
};

/** What `import.meta.glob("../**\/*.stories.tsx", { eager: true })` returns. */
export type StoryModules = Record<string, unknown>;

export type ComposeStories = (
  module: Record<string, unknown>,
) => Record<string, ComposedPreviewStory>;

export function resolveStories(
  modules: StoryModules,
  composeStories: ComposeStories,
): StoryCatalog {
  const stories = new Map<string, CatalogStory>();
  const problems: string[] = [];
  for (const [file, value] of Object.entries(modules)) {
    if (typeof value !== "object" || value === null) continue;
    const module = value as Record<string, unknown>;
    const meta = module.default;
    if (typeof meta !== "object" || meta === null) {
      problems.push(`${file} has no default export with the story's meta.`);
      continue;
    }
    const title = (meta as { title?: unknown }).title;
    if (typeof title !== "string" || title === "") {
      problems.push(
        `${file} needs a \`title\` in its meta, so its story IDs match Storybook's.`,
      );
      continue;
    }
    let composed: Record<string, ComposedPreviewStory>;
    try {
      composed = composeStories(module);
    } catch (error) {
      problems.push(`${file} could not be composed: ${errorMessage(error)}`);
      continue;
    }
    for (const Story of Object.values(composed)) {
      if (stories.has(Story.id)) {
        problems.push(`${file} reuses the story ID "${Story.id}".`);
        continue;
      }
      stories.set(Story.id, {
        id: Story.id,
        title,
        name: Story.storyName,
        description: storyDescription(Story.parameters),
        hasPlay: Story.play !== undefined,
        Story,
      });
    }
  }
  return { stories, problems };
}

export function storyInfo({ Story: _Story, ...info }: CatalogStory) {
  return info;
}

function storyDescription(parameters: Record<string, unknown>) {
  const docs = parameters.docs as
    | { description?: { story?: unknown } }
    | undefined;
  const story = docs?.description?.story;
  return typeof story === "string" ? story : undefined;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
