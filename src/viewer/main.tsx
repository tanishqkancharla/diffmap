import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider, P } from "maui";
import type { Book, BookPage } from "../book.js";
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
  page?: BookPage;
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

function pageHref(target: BookPage) {
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

const [initialPage, initialBook] = await Promise.all([
  loadPage(pageSegment()),
  // SAFETY: `serve` answers with this shape from readBook.
  fetch("/__diffmap/book").then((response) => response.json()) as Promise<
    Book | { error: string }
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

// `serve` names each page file that changes, or sends `book` when the list of pages changed.
const reloadToken =
  document.querySelector<HTMLMetaElement>('meta[name="diffmap-reload-token"]')
    ?.content ?? "";
const reloadSocket = new WebSocket(
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/__diffmap/events?${new URLSearchParams({ token: reloadToken })}`,
);
reloadSocket.addEventListener("message", (event) => {
  if (event.data === "book" || event.data === shownFile)
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

function LocalApp() {
  const [load, setLoad] = useState(initialPage);
  const book = "error" in initialBook ? undefined : initialBook;

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
    book?.pages.find((candidate) => candidate.file === load.page?.file) ??
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
        book={
          book === undefined || current === undefined
            ? undefined
            : {
                title: book.title,
                pages: book.pages,
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
