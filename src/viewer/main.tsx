import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider, P } from "maui";
import type { ViewerDocument } from "../parseViewer.js";
import { ViewerApp } from "./ViewerApp.tsx";
import { GistStatus } from "../gist/GistStatus.tsx";
import { localMediaUrl, MediaResolverContext } from "./Media.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("diffmap root element is missing");

// SAFETY: `serve` answers with this shape from parseViewerDocument.
const { viewerDocument, parseError } = (await fetch("/__diffmap/document").then(
  (response) => response.json(),
)) as { viewerDocument?: ViewerDocument; parseError?: string };

// `serve` sends a message whenever the spec file changes.
const reloadToken =
  document.querySelector<HTMLMetaElement>('meta[name="diffmap-reload-token"]')
    ?.content ?? "";
const reloadSocket = new WebSocket(
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/__diffmap/events?${new URLSearchParams({ token: reloadToken })}`,
);
reloadSocket.addEventListener("message", () => {
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
