import {
  createContext,
  type KeyboardEvent,
  useContext,
  useRef,
  useState,
} from "react";
import {
  Button,
  ChevronLeft,
  ChevronRight,
  Tooltip,
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

/** An image, or a player for a recording, chosen by file extension. */
export function Media(props: {
  src: string;
  alt: string | undefined;
  title: string | undefined;
  className?: string;
}) {
  const resolve = useContext(MediaResolverContext);
  const url = isLocalMedia(props.src) ? resolve(props.src) : props.src;
  const inline = useStyles(styles.media);
  // A card styles its media; an image inside a sentence keeps the inline style.
  const classes = props.className ?? inline;
  if (isVideoSource(props.src)) {
    return (
      <video
        className={classes}
        src={url}
        title={props.title}
        aria-label={props.alt}
        controls
        playsInline
        preload="metadata"
      />
    );
  }
  return (
    <img className={classes} src={url} alt={props.alt} title={props.title} />
  );
}

/** A card like a code block: the alt text as its title row, then the media, edge to edge. */
export function MediaCard(props: { item: ViewerElement }) {
  const frame = useStyles(pierreShell, styles.frame);
  const title = useStyles(fenceTitle);
  const media = useStyles(styles.cardMedia);
  const label = props.item.attrs.alt;
  return (
    <figure className={frame} data-diffmap-kind="media">
      {label !== undefined && label !== "" && (
        <figcaption className={title}>{label}</figcaption>
      )}
      <Media
        src={props.item.attrs.src ?? ""}
        alt={label}
        title={props.item.attrs.title}
        className={media}
      />
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
  const header = useStyles(fenceTitle, styles.carouselHeader);
  const description = useStyles(styles.description);
  const stackClass = useStyles(styles.stack);
  const slide = useStyles(styles.slide);
  const media = useStyles(styles.cardMedia);
  const stack = useRef<HTMLDivElement>(null);
  // A video keeps playing when hidden, so moving on pauses them all.
  const goTo = (next: number) => {
    for (const video of stack.current?.querySelectorAll("video") ?? [])
      video.pause();
    setIndex(next);
  };
  const onKeyDown = (event: KeyboardEvent) => {
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
            <Media
              src={item.attrs.src ?? ""}
              alt={item.attrs.alt}
              title={item.attrs.title}
              className={media}
            />
          </div>
        ))}
      </div>
    </figure>
  );
}

const styles = {
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
  carouselHeader: style(
    flex({ direction: "row", alignItems: "center", gap: 1 }),
    {
      // The buttons overhang the text line, so this row matches every other title row.
      "& button": { marginBlock: -3 },
    },
  ),
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
