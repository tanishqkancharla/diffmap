import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider, P } from "maui";
import type { Spec, SpecPage } from "../spec.js";
import type { ViewerDocument } from "../parseViewer.js";
import { ViewerApp } from "./ViewerApp.tsx";
import { GistStatus } from "../gist/GistStatus.tsx";
import { localMediaUrl, MediaResolverContext } from "./Media.tsx";
import { enableViewerTelemetry, trackViewerEvent } from "./telemetry.ts";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("diffmap root element is missing");

/** `serve`'s answer for one page, from parseViewerDocument. */
type PageLoad = {
  page?: SpecPage;
  viewerDocument?: ViewerDocument;
  parseError?: string;
};

async function loadPage(segment: string) {
  // SAFETY: `serve` answers with this shape.
  return (await fetch(
    `/__diffmap/document?${new URLSearchParams({ page: segment })}`,
  ).then((response) => response.json())) as PageLoad;
}

/** The page the URL names: `/` is the cover, `/<slug>` a page. */
function pageSegment() {
  return decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, "");
}

function pageHref(target: SpecPage) {
  return `/${encodeURIComponent(target.slug)}`;
}

/** A link to a page's file, such as /02-write-through.md, settles on the page's own URL, which names its comments. */
function settleUrl(load: PageLoad) {
  if (load.page === undefined) return;
  const href = pageHref(load.page);
  if (window.location.pathname !== href) {
    window.history.replaceState(
      window.history.state,
      "",
      `${href}${window.location.hash}`,
    );
  }
}

const [initialPage, initialSpec] = await Promise.all([
  loadPage(pageSegment()),
  // SAFETY: `serve` answers with this shape from readSpec.
  fetch("/__diffmap/spec").then((response) => response.json()) as Promise<
    Spec | { error: string }
  >,
]);
settleUrl(initialPage);
let shownFile = initialPage.page?.file;

enableViewerTelemetry();
trackViewerEvent({ event: "viewer_opened" });

/** A page that stopped parsing after an edit shows the error instead. */
function trackPageError(load: PageLoad) {
  if (load.viewerDocument === undefined)
    trackViewerEvent({ event: "viewer_error", kind: "document" });
}
trackPageError(initialPage);

// `serve` names each page file that changes, or sends `pages` when the list of pages changed.
const reloadToken =
  document.querySelector<HTMLMetaElement>('meta[name="diffmap-reload-token"]')
    ?.content ?? "";
const reloadUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/__diffmap/events?${new URLSearchParams({ token: reloadToken })}`;
let reloadSocketEverOpened = false;
openReloadSocket();

// A closed socket does not mean the server restarted: proxies, port forwards, and sleep drop idle sockets while the same server runs.
// So the page reconnects, and reloads only when a server answers but refuses this page's token, which a restarted server does.
function openReloadSocket() {
  const socket = new WebSocket(reloadUrl);
  let opened = false;
  socket.addEventListener("message", (event) => {
    if (event.data === "pages" || event.data === shownFile)
      window.location.reload();
  });
  socket.addEventListener("open", () => {
    opened = true;
    reloadSocketEverOpened = true;
  });
  socket.addEventListener("close", () => {
    if (opened) setTimeout(openReloadSocket, 1000);
    else if (reloadSocketEverOpened) setTimeout(reloadWhenServerAnswers, 1000);
  });
}

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

function LocalApp() {
  const [load, setLoad] = useState(initialPage);
  const spec = "error" in initialSpec ? undefined : initialSpec;

  useEffect(() => {
    // Back and forward load the page the URL names; a jump to a heading on the same page stays put.
    const onPop = () => {
      // oxlint-disable-next-line typescript/no-floating-promises -- The event owns this load.
      void loadPage(pageSegment()).then((next) => {
        if (next.page?.file === shownFile) return;
        shownFile = next.page?.file;
        setLoad(next);
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const current =
    spec?.pages.find((candidate) => candidate.file === load.page?.file) ??
    load.page;
  if (load.viewerDocument === undefined) {
    return (
      <GistStatus title="Could not parse this spec">
        <P>{load.parseError ?? "Unknown parse error."}</P>
      </GistStatus>
    );
  }
  return (
    <MediaResolverContext.Provider value={localMediaUrl}>
      <ViewerApp
        // Each page has its own comments, Reviewed files, and Diff panel.
        key={current?.file}
        document={load.viewerDocument}
        mode="local"
        spec={
          spec === undefined || current === undefined
            ? undefined
            : {
                title: spec.title,
                pages: spec.pages,
                current,
                href: pageHref,
                navigate: (page, hash) => {
                  // oxlint-disable-next-line typescript/no-floating-promises -- Navigation owns this load.
                  void loadPage(page.slug).then((next) => {
                    trackPageError(next);
                    window.history.pushState(
                      {},
                      "",
                      `${pageHref(page)}${hash}`,
                    );
                    shownFile = next.page?.file;
                    setLoad(next);
                  });
                },
              }
        }
      />
    </MediaResolverContext.Provider>
  );
}

createRoot(root).render(
  <StrictMode>
    <MauiProvider>
      <LocalApp />
    </MauiProvider>
  </StrictMode>,
);
