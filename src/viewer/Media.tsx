import {
  createContext,
  type KeyboardEvent,
  type ReactEventHandler,
  type Ref,
  useContext,
  useRef,
  useState,
} from "react";
import {
  Button,
  ChevronLeft,
  ChevronRight,
  Close,
  Dialog,
  Maximize,
  Text,
  Tooltip,
  backgroundColor,
  border,
  flex,
  radius,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { isLocalMedia, isVideoSource } from "../media.js";
import type { ViewerElement } from "../parseViewer.js";
import { fenceTitle, pierreShell } from "./pierre.js";

/** Turns a path written in the spec into a URL. Remote URLs never reach it. */
export const MediaResolverContext = createContext((src: string) => src);

/** `/__diffmap/media` serves a path relative to the spec from the local server. */
export function localMediaUrl(src: string) {
  return `/__diffmap/media?${new URLSearchParams({ path: src }).toString()}`;
}

type MediaProps = {
  src: string;
  alt: string | undefined;
  title: string | undefined;
  className?: string;
};

function mediaLabel(media: MediaProps) {
  return (
    media.alt || media.title || (isVideoSource(media.src) ? "Video" : "Image")
  );
}

/** An image, or a player for a recording, chosen by file extension. */
function MediaContent({
  videoRef,
  onLoadedMetadata,
  ...props
}: MediaProps & {
  videoRef?: Ref<HTMLVideoElement>;
  onLoadedMetadata?: ReactEventHandler<HTMLVideoElement>;
}) {
  const resolve = useContext(MediaResolverContext);
  const url = isLocalMedia(props.src) ? resolve(props.src) : props.src;
  const inline = useStyles(styles.media);
  const className = props.className ?? inline;
  if (isVideoSource(props.src)) {
    return (
      <video
        ref={videoRef}
        className={className}
        src={url}
        title={props.title}
        aria-label={props.alt}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
      />
    );
  }
  return (
    <img className={className} src={url} alt={props.alt} title={props.title} />
  );
}

function MediaExpandButton(props: { media: MediaProps; onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="quiet"
      aria-label={`Full screen: ${mediaLabel(props.media)}`}
      onClick={props.onClick}
    >
      <Maximize size="xs" />
    </Button>
  );
}

/** Cards, carousels, and inline media share the dialog and playback handoff. */
function useExpandedMedia() {
  const [selection, setSelection] = useState<{
    media: MediaProps;
    video: HTMLVideoElement | null | undefined;
  }>();
  const [fullscreen, setFullscreen] = useState(false);
  const expandedVideo = useRef<HTMLVideoElement>(null);
  const resume = useRef(false);
  const dialog = useStyles(styles.dialog);
  const header = useStyles(styles.dialogHeader);
  const expanded = useStyles(styles.expandedMedia);
  const transferPlayback = (from: HTMLVideoElement, to: HTMLVideoElement) => {
    to.currentTime = from.currentTime;
    to.volume = from.volume;
    to.muted = from.muted;
    to.playbackRate = from.playbackRate;
    if (resume.current) void to.play().catch(() => {});
  };
  const open = (
    media: MediaProps,
    video: HTMLVideoElement | null | undefined,
  ) => {
    resume.current = Boolean(video && !video.paused && !video.ended);
    video?.pause();
    setSelection({ media, video });
    setFullscreen(true);
  };
  const close = () => {
    const from = expandedVideo.current;
    const to = selection?.video;
    if (from && to) {
      // Closing before metadata arrives must not reset the inline player's position.
      if (from.readyState === 0) {
        if (resume.current) void to.play().catch(() => {});
      } else {
        resume.current = !from.paused && !from.ended;
        from.pause();
        transferPlayback(from, to);
      }
    }
    setFullscreen(false);
  };
  return {
    open,
    dialog: (
      <Dialog
        isOpen={fullscreen}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        size="lg"
        aria-label={selection ? mediaLabel(selection.media) : "Media"}
        className={dialog}
      >
        <div className={header}>
          <Text size="xs" fontWeight={500} color="lowContrast">
            {selection && mediaLabel(selection.media)}
          </Text>
          <Button
            size="sm"
            variant="quiet"
            slot="close"
            aria-label="Exit full screen"
          >
            <Close size="xs" />
          </Button>
        </div>
        {selection && (
          <MediaContent
            key={selection.media.src}
            {...selection.media}
            className={expanded}
            videoRef={expandedVideo}
            onLoadedMetadata={(event) => {
              if (fullscreen && selection.video)
                transferPlayback(selection.video, event.currentTarget);
            }}
          />
        )}
      </Dialog>
    ),
  };
}

/** Media inside a sentence has no card header, so its action stays overlaid. */
export function Media(props: MediaProps) {
  const shell = useStyles(styles.mediaShell);
  const expand = useStyles(styles.expand);
  const video = useRef<HTMLVideoElement>(null);
  const expanded = useExpandedMedia();
  return (
    <span className={shell}>
      <MediaContent {...props} videoRef={video} />
      <span className={expand}>
        <MediaExpandButton
          media={props}
          onClick={() => expanded.open(props, video.current)}
        />
      </span>
      {expanded.dialog}
    </span>
  );
}

/** A card like a code block: the alt text and action, then the media, edge to edge. */
export function MediaCard(props: { item: ViewerElement }) {
  const frame = useStyles(pierreShell, styles.frame);
  const header = useStyles(fenceTitle, styles.cardHeader);
  const className = useStyles(styles.cardMedia);
  const video = useRef<HTMLVideoElement>(null);
  const expanded = useExpandedMedia();
  const media = {
    src: props.item.attrs.src ?? "",
    alt: props.item.attrs.alt,
    title: props.item.attrs.title,
  };
  return (
    <figure className={frame} data-diffmap-kind="media">
      <figcaption className={header}>
        <Text
          size="xs"
          fontWeight={500}
          color="lowContrast"
          style={{ marginRight: "auto" }}
        >
          {media.alt}
        </Text>
        <MediaExpandButton
          media={media}
          onClick={() => expanded.open(media, video.current)}
        />
      </figcaption>
      <MediaContent {...media} className={className} videoRef={video} />
      {expanded.dialog}
    </figure>
  );
}

/** Amp's `:::gallery`: images and videos labeled with their alt text. */
export function Gallery(props: { node: ViewerElement }) {
  const items = props.node.children.flatMap((child) =>
    child.type === "element" ? [child] : [],
  );
  const layout = props.node.attrs.layout;
  if (layout === "carousel")
    return <Carousel items={items} title={props.node.attrs.title} />;
  return (
    <GalleryGrid
      items={items}
      columns={layout === "side-by-side" ? items.length : undefined}
    />
  );
}

function GalleryGrid(props: {
  items: ViewerElement[];
  /** Side by side keeps every item in one row; a grid wraps. */
  columns: number | undefined;
}) {
  const className = useStyles(styles.grid);
  return (
    <div
      className={className}
      data-diffmap-kind="gallery"
      style={{
        gridTemplateColumns:
          props.columns === undefined
            ? "repeat(auto-fill, minmax(min(240px, 100%), 1fr))"
            : `repeat(${props.columns}, minmax(0, 1fr))`,
      }}
    >
      {props.items.map((item, index) => (
        <MediaCard key={index} item={item} />
      ))}
    </div>
  );
}

function Carousel(props: {
  items: ViewerElement[];
  title: string | undefined;
}) {
  const [index, setIndex] = useState(0);
  const last = props.items.length - 1;
  const current = props.items[index]!;
  const frame = useStyles(pierreShell, styles.frame);
  const header = useStyles(fenceTitle, styles.cardHeader);
  const description = useStyles(styles.description);
  const stackClass = useStyles(styles.stack);
  const slide = useStyles(styles.slide);
  const media = useStyles(styles.cardMedia);
  const stack = useRef<HTMLDivElement>(null);
  const expanded = useExpandedMedia();
  const currentMedia = {
    src: current.attrs.src ?? "",
    alt: current.attrs.alt,
    title: current.attrs.title,
  };
  // A video keeps playing when hidden, so moving on pauses them all.
  const goTo = (next: number) => {
    for (const video of stack.current?.querySelectorAll("video") ?? [])
      video.pause();
    setIndex(next);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    // Native player keys and portaled dialog keys must not change slides.
    if (
      event.target instanceof Element &&
      event.target.closest("video, [role='dialog']")
    )
      return;
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      goTo(index - 1);
    }
    if (event.key === "ArrowRight" && index < last) {
      event.preventDefault();
      goTo(index + 1);
    }
  };
  return (
    <figure
      className={frame}
      data-diffmap-kind="gallery"
      aria-roledescription="carousel"
      aria-label={props.title}
      // Capture: Maui's Button stops arrow keys from bubbling.
      onKeyDownCapture={onKeyDown}
    >
      {/* The title row stays put; only the counter and the description below change. */}
      <figcaption className={header}>
        <span>{props.title}</span>
        <span style={{ marginLeft: "auto" }}>
          {index + 1} / {last + 1}
        </span>
        <Tooltip content="Previous (←)" placement="top">
          <Button
            size="sm"
            variant="quiet"
            aria-label="Previous"
            isDisabled={index === 0}
            onClick={() => goTo(index - 1)}
          >
            <ChevronLeft size="xs" />
          </Button>
        </Tooltip>
        <Tooltip content="Next (→)" placement="top">
          <Button
            size="sm"
            variant="quiet"
            aria-label="Next"
            isDisabled={index === last}
            onClick={() => goTo(index + 1)}
          >
            <ChevronRight size="xs" />
          </Button>
        </Tooltip>
        <MediaExpandButton
          media={currentMedia}
          onClick={() =>
            expanded.open(
              currentMedia,
              stack.current?.querySelector<HTMLVideoElement>(
                "[data-current='true'] video",
              ),
            )
          }
        />
      </figcaption>
      <div className={description} aria-live="polite">
        {current.attrs.alt}
      </div>
      {/* Every slide shares one grid cell, so the card fits the tallest and keeps its height. */}
      <div ref={stack} className={stackClass}>
        {props.items.map((item, itemIndex) => (
          <div
            key={itemIndex}
            className={slide}
            data-current={itemIndex === index}
            aria-hidden={itemIndex !== index}
            inert={itemIndex !== index}
          >
            <MediaContent
              src={item.attrs.src ?? ""}
              alt={item.attrs.alt}
              title={item.attrs.title}
              className={media}
            />
          </div>
        ))}
      </div>
      {expanded.dialog}
    </figure>
  );
}

const styles = {
  mediaShell: style({
    position: "relative",
    display: "inline-block",
    maxWidth: "100%",
    verticalAlign: "middle",
  }),
  expand: style(radius.sm, {
    display: "inline-flex",
    position: "absolute",
    top: "6px",
    right: "6px",
    backgroundColor: backgroundColor.element,
  }),
  dialog: style({
    width: "calc(100vw - 32px)",
    height: "calc(100dvh - 32px)",
    padding: spacing.value(6),
    "& > [role='dialog']": { flex: 1, minHeight: 0, gap: spacing.value(2) },
  }),
  dialogHeader: style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.value(4),
  }),
  expandedMedia: style({
    display: "block",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
  }),
  media: style(radius.sm, {
    maxWidth: "100%",
    height: "auto",
    verticalAlign: "middle",
  }),
  frame: style({ width: "100%", margin: 0 }),
  // The media fills the card below its title row; the card's corners clip it.
  cardMedia: style({
    display: "block",
    width: "100%",
    maxHeight: "min(70vh, 640px)",
    objectFit: "contain",
  }),
  grid: style({ display: "grid", gap: spacing.value(6), alignItems: "start" }),
  cardHeader: style(flex({ direction: "row", alignItems: "center", gap: 1 }), {
    // The buttons overhang the text line, so this row matches every other title row.
    "& button": { marginBlock: -3 },
  }),
  description: style(
    text({ size: "sm" }),
    spacing.padding({ x: 6, y: 3 }),
    border(["bottom"], "border"),
    // Holds a line even for an unlabeled item, so the media below stays put.
    { minHeight: "1lh", boxSizing: "content-box" },
  ),
  stack: style({ display: "grid" }),
  slide: style({
    gridArea: "1 / 1",
    display: "flex",
    alignItems: "center",
    "&[data-current='false']": { visibility: "hidden" },
  }),
};
