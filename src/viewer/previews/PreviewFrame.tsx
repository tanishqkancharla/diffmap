import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
  PlugOff,
  Refresh,
  colors,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import type {
  PreviewRouteMessage,
  PreviewStoryInfo,
  PreviewViewerMessage,
} from "../../preview/protocol.js";
import { usePreviewsSource } from "./config.ts";

export type FrameRequest = {
  path: string[];
  how: "render" | "play";
  /** Bumped for each request, so asking for the same state twice still sends it. */
  seq: number;
};

type FrameProps = {
  /** The app's preview page, from `previews.local`. */
  page: string;
  /** The state the frame first loads, by its path; later states come through `request`. */
  initialPath: string[];
  mode: "live" | "thumbnail";
  request?: FrameRequest;
  /** Render the app this wide and scale it to the frame's width, as a thumbnail or a fixed viewport does. */
  renderWidth?: number;
  /** A fixed height to render at instead of the story's own height. */
  renderHeight?: number;
  maxHeight?: number;
  /** Load only once the frame nears the viewport, so a long flow does not start every copy of the app at once. */
  lazy?: boolean;
  label: string;
  onReady?: (stories: PreviewStoryInfo[]) => void;
  onState?: (state: { story: string; fingerprint: string }) => void;
  onError?: (message: string) => void;
};

/** How long the page has to say hello before the frame says it can't reach it. */
const CONNECT_TIMEOUT_MS = 8000;

/** One iframe of the app's preview page, which renders the story it is asked for with the app's own build. */
export function PreviewFrame(props: FrameProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <ConnectedFrame
      key={attempt}
      {...props}
      onRetry={() => setAttempt(attempt + 1)}
    />
  );
}

function ConnectedFrame(props: FrameProps & { onRetry: () => void }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(props.lazy !== true);
  const [status, setStatus] = useState<"loading" | "ready" | "unreachable">(
    "loading",
  );
  const [contentHeight, setContentHeight] = useState<number | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [boxWidth, setBoxWidth] = useState<number | undefined>();
  const [src] = useState(() => frameSrc(props.page, props.initialPath));
  const pending = useRef<FrameRequest | undefined>(undefined);
  const sent = useRef(0);
  const flushRef = useRef<() => void>(() => {});
  const modeRef = useRef<(mode: "live" | "thumbnail") => void>(() => {});
  const settled = useRef(false);
  const callbacks = useRef(props);
  useLayoutEffect(() => {
    callbacks.current = props;
  });
  const origin = new URL(props.page, window.location.href).origin;
  const deployed = usePreviewsSource().deployment !== undefined;

  useEffect(() => {
    if (visible) return;
    const element = box.current!;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  useLayoutEffect(() => {
    if (props.renderWidth === undefined) return;
    const element = box.current!;
    const observer = new ResizeObserver(() => setBoxWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.renderWidth]);

  useEffect(() => {
    if (!visible) return;
    const frame = iframe.current!;
    const post = (message: PreviewViewerMessage) =>
      frame.contentWindow?.postMessage(message, origin);
    const flush = () => {
      const request = pending.current;
      if (request === undefined || request.seq === sent.current) return;
      sent.current = request.seq;
      post({
        type: "preview-show",
        story: request.path.at(-1)!,
        how: request.how,
        path: request.path,
      });
    };
    let ready = false;
    const timeout = setTimeout(() => {
      if (!ready) setStatus("unreachable");
    }, CONNECT_TIMEOUT_MS);
    const connect = () => post({ type: "preview-connect" });
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== origin)
        return;
      // SAFETY: the frame only posts the page's messages; unknown types fall through.
      const message = event.data as PreviewRouteMessage;
      switch (message?.type) {
        case "preview-hello":
          connect();
          return;
        case "preview-ready":
          ready = true;
          clearTimeout(timeout);
          setStatus("ready");
          post({ type: "preview-mode", mode: callbacks.current.mode });
          callbacks.current.onReady?.(message.stories);
          flush();
          return;
        case "preview-size":
          setContentHeight(message.height);
          return;
        case "preview-state":
          settled.current = true;
          setError(undefined);
          callbacks.current.onState?.(message);
          return;
        case "preview-error":
          setError(message.message);
          callbacks.current.onError?.(message.message);
          return;
      }
    };
    window.addEventListener("message", onMessage);
    frame.addEventListener("load", connect);
    flushRef.current = () => {
      if (ready) flush();
    };
    modeRef.current = (mode) => {
      if (ready) post({ type: "preview-mode", mode });
    };
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      frame.removeEventListener("load", connect);
    };
  }, [visible, origin]);

  useEffect(() => {
    if (!visible) return;
    const frame = iframe.current!;
    const giveFocusBack = () =>
      requestAnimationFrame(() => {
        if (document.activeElement !== frame) return;
        if (callbacks.current.mode === "live" && settled.current) return;
        frame.blur();
        if (lastFocused?.isConnected)
          lastFocused.focus({ preventScroll: true });
      });
    window.addEventListener("blur", giveFocusBack);
    return () => window.removeEventListener("blur", giveFocusBack);
  }, [visible]);

  useEffect(() => {
    if (props.request === undefined) return;
    pending.current = props.request;
    flushRef.current();
  }, [props.request]);

  useEffect(() => {
    modeRef.current(props.mode);
  }, [props.mode]);

  const scale =
    props.renderWidth === undefined || boxWidth === undefined
      ? 1
      : Math.min(1, boxWidth / props.renderWidth);
  const height = props.renderHeight ?? contentHeight ?? 160;
  const shownHeight = Math.min(height * scale, props.maxHeight ?? Infinity);

  const boxClass = useStyles(styles.box);
  const frameClass = useStyles(
    styles.frame,
    props.mode === "thumbnail" && styles.inert,
  );
  const overlay = useStyles(styles.overlay);
  const errorClass = useStyles(styles.error);
  return (
    <div
      ref={box}
      className={boxClass}
      style={{ height: shownHeight }}
      data-preview-status={status}
    >
      {visible && (
        <iframe
          ref={iframe}
          // oxlint-disable-next-line react/iframe-missing-sandbox -- The app runs at its own origin, apart from the viewer's; its fake server is a service worker, which needs that origin.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          src={src}
          title={props.label}
          className={frameClass}
          tabIndex={props.mode === "thumbnail" ? -1 : undefined}
          aria-hidden={props.mode === "thumbnail" || undefined}
          style={{
            width: props.renderWidth ?? "100%",
            height: props.renderWidth === undefined ? shownHeight : height,
            transform: scale === 1 ? undefined : `scale(${scale})`,
          }}
        />
      )}
      {status === "loading" && (
        <div className={overlay}>
          <ActivityIndicator />
        </div>
      )}
      {status === "unreachable" && (
        <div className={overlay} role="alert">
          <PlugOff size="md" />
          {deployed ? (
            <span>
              The pull request's preview deployment isn't answering at{" "}
              {props.page}.
            </span>
          ) : (
            <span>Can't reach the app's preview page at {props.page}.</span>
          )}
          {props.mode === "live" && (
            <>
              {deployed ? (
                <span>
                  It may still be building: retry in a minute, or <RunLocally />
                  .
                </span>
              ) : (
                <span>Start the app's dev server, then retry.</span>
              )}
              <Button size="sm" onClick={props.onRetry}>
                <Refresh size="xs" />
                Retry
              </Button>
            </>
          )}
        </div>
      )}
      {error !== undefined && props.mode === "live" && (
        <div className={errorClass} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

/** The guide's section on serving a spec, for when a block can't show live UI here. */
export function RunLocally() {
  const className = useStyles(styles.inlineLink);
  return (
    <a
      className={className}
      href="https://github.com/tanishqkancharla/diffmap/blob/main/guide.md#serve-and-share"
    >
      run this spec with product-doc serve
    </a>
  );
}

/** Where focus was before a replaying frame took it; frames focus their inputs as their steps replay. */
let lastFocused: HTMLElement | undefined;
document.addEventListener("focusin", (event) => {
  if (event.target instanceof HTMLElement && event.target.tagName !== "IFRAME")
    lastFocused = event.target;
});

function frameSrc(page: string, path: string[]) {
  const url = new URL(page, window.location.href);
  url.searchParams.set("story", path.at(-1)!);
  if (path.length > 1) url.searchParams.set("path", path.join(","));
  return url.href;
}

const styles = {
  box: style({
    position: "relative",
    width: "100%",
    overflow: "hidden",
    transition: "height 160ms ease-out",
  }),
  frame: style({
    display: "block",
    border: 0,
    transformOrigin: "0 0",
    backgroundColor: "white",
  }),
  inert: style({ pointerEvents: "none" }),
  // Maui's Link sets its own text size; this one sits inside a notice's smaller text.
  inlineLink: style({
    font: "inherit",
    color: colors.gray[12],
    textDecorationLine: "underline",
    textUnderlineOffset: "2px",
  }),
  overlay: style(
    text({ size: "xs", color: "lowContrast" }),
    spacing.padding({ all: 6 }),
    {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.value(3),
      textAlign: "center",
      backgroundColor: colors.gray[2],
    },
  ),
  error: style(text({ size: "xs" }), spacing.padding({ x: 4, y: 2 }), {
    position: "absolute",
    insetInline: 0,
    bottom: 0,
    color: colors.red[11],
    backgroundColor: colors.red[2],
  }),
};
