import type { ViewerEvent } from "../serve.js";

let enabled = false;

/** Only the local viewer reports events, to its own `serve` process, which applies the CLI's opt-outs and ID. */
export function enableViewerTelemetry() {
  enabled = true;
}

/** Reports one action by name and fixed values; nothing from the spec is sent. */
export function trackViewerEvent(event: ViewerEvent) {
  if (!enabled) return;
  fetch("/__diffmap/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    // Lets an event sent as the page closes, such as from Close server, still arrive.
    keepalive: true,
  }).catch(() => undefined);
}

/** Reports `viewer_engaged` once: after 30 s visible in total, or when the reader scrolls past half of `scroller`. Returns a cleanup. */
export function trackEngagement(scroller: HTMLElement) {
  if (!enabled) return undefined;
  let visibleSeconds = 0;
  const timer = setInterval(() => {
    if (document.visibilityState === "visible") visibleSeconds += 1;
    if (visibleSeconds >= 30) engaged("time");
  }, 1000);
  const onScroll = () => {
    if (
      (scroller.scrollTop + scroller.clientHeight) * 2 >=
      scroller.scrollHeight
    )
      engaged("scroll");
  };
  scroller.addEventListener("scroll", onScroll, { passive: true });
  const stop = () => {
    clearInterval(timer);
    scroller.removeEventListener("scroll", onScroll);
  };
  function engaged(trigger: "time" | "scroll") {
    stop();
    trackViewerEvent({ event: "viewer_engaged", trigger });
  }
  return stop;
}
