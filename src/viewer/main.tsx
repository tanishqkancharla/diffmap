import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider, P } from "maui";
import type { BookPage } from "../book.js";
import type { ViewerDocument } from "../parseViewer.js";
import { ViewerApp } from "./ViewerApp.tsx";
import { GistStatus } from "../gist/GistStatus.tsx";
import { localMediaUrl, MediaResolverContext } from "./Media.tsx";
import { enableViewerTelemetry, trackViewerEvent } from "./telemetry.ts";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("diffmap root element is missing");

// SAFETY: `serve` answers with this shape from parseViewerDocument.
const { page, viewerDocument, parseError } = (await fetch(
  `/__diffmap/document?${new URLSearchParams({ page: pageSegment() })}`,
).then((response) => response.json())) as {
  page?: BookPage;
  viewerDocument?: ViewerDocument;
  parseError?: string;
};
// A link to a page's file, such as /02-write-through.md, settles on the page's own URL, which names its comments.
if (page !== undefined && window.location.pathname !== pageHref(page)) {
  window.history.replaceState(
    window.history.state,
    "",
    `${pageHref(page)}${window.location.hash}`,
  );
}

enableViewerTelemetry();
trackViewerEvent({ event: "viewer_opened" });
// The spec stopped parsing after an edit, so the page shows the error instead.
if (viewerDocument === undefined)
  trackViewerEvent({ event: "viewer_error", kind: "document" });

/** The page the URL names: `/` is the cover, `/<slug>` a page. */
function pageSegment() {
  return decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, "");
}

function pageHref(target: BookPage) {
  return `/${encodeURIComponent(target.slug)}`;
}

// `serve` names each page file that changes, or sends `book` when the list of pages changed.
const reloadToken =
  document.querySelector<HTMLMetaElement>('meta[name="diffmap-reload-token"]')
    ?.content ?? "";
const reloadSocket = new WebSocket(
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/__diffmap/events?${new URLSearchParams({ token: reloadToken })}`,
);
reloadSocket.addEventListener("message", (event) => {
  if (event.data === "book" || event.data === page?.file)
    window.location.reload();
});
// Like Vite's client: once the server goes away, reload when one answers on this port again.
let reloadSocketOpened = false;
reloadSocket.addEventListener("open", () => {
  reloadSocketOpened = true;
});
reloadSocket.addEventListener("close", () => {
  if (reloadSocketOpened) setTimeout(reloadWhenServerAnswers, 1000);
});

function reloadWhenServerAnswers() {
  // oxlint-disable-next-line typescript/no-floating-promises -- A timer owns this poll.
  void fetch("/__diffmap/meta").then(
    (response) => {
      if (response.ok) window.location.reload();
      else setTimeout(reloadWhenServerAnswers, 1000);
    },
    () => setTimeout(reloadWhenServerAnswers, 1000),
  );
}

createRoot(root).render(
  <StrictMode>
    <MauiProvider>
      {viewerDocument === undefined ? (
        <GistStatus title="Could not parse this spec">
          <P>{parseError ?? "Unknown parse error."}</P>
        </GistStatus>
      ) : (
        <MediaResolverContext.Provider value={localMediaUrl}>
          <ViewerApp document={viewerDocument} mode="local" />
        </MediaResolverContext.Provider>
      )}
    </MauiProvider>
  </StrictMode>,
);
