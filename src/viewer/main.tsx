import { StrictMode, useEffect, useEffectEvent, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  FileError,
  FileSearch,
  Flex,
  Label,
  Link,
  LoadingScreen,
  MauiProvider,
  P,
  PlugOff,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { Spec, SpecPage } from "../spec.js";
import type { ViewerDocument } from "../parseViewer.js";
import { ViewerApp } from "./ViewerApp.tsx";
import {
  RetryButton,
  SpecErrorPage,
  StatusLink,
  StatusPage,
} from "./StatusPage.tsx";
import { localMediaUrl, MediaResolverContext } from "./Media.tsx";
import { enableViewerTelemetry, trackViewerEvent } from "./telemetry.ts";
import { setServerConnection } from "./serverConnection.ts";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("diffmap root element is missing");

/** `serve`'s answer for one page. */
type PageLoad = {
  page?: SpecPage;
  viewerDocument?: ViewerDocument;
  /** The page's file did not parse. */
  parseError?: string;
  /** The URL names no page of the spec. */
  missingPage?: string;
  /** The spec itself could not be read. */
  specError?: string;
};

type SpecLoad = Spec | { error: string };

async function loadJson(url: string) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`${url} answered ${String(response.status)}`);
  return (await response.json()) as unknown;
}

async function loadPage(segment: string) {
  // SAFETY: `serve` answers with this shape.
  return (await loadJson(
    `/__diffmap/document?${new URLSearchParams({ page: segment })}`,
  )) as PageLoad;
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

const initialLoad = Promise.all([
  loadPage(pageSegment()),
  // SAFETY: `serve` answers with this shape from readSpec.
  loadJson("/__diffmap/spec") as Promise<SpecLoad>,
]);
let shownFile: string | undefined;

enableViewerTelemetry();
trackViewerEvent({ event: "viewer_opened" });

/** A page that stopped parsing after an edit shows the error instead. */
function trackPageError(load: PageLoad) {
  if (load.viewerDocument === undefined)
    trackViewerEvent({ event: "viewer_error", kind: "document" });
}

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
    setServerConnection("connected");
  });
  socket.addEventListener("close", () => {
    if (opened) {
      setServerConnection("disconnected");
      setTimeout(openReloadSocket, 1000);
    } else if (reloadSocketEverOpened)
      setTimeout(reloadWhenServerAnswers, 1000);
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
  const [boot, setBoot] = useState<
    { page: PageLoad; spec: SpecLoad } | Error | undefined
  >();
  useEffect(() => {
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns this load; it settles once per page load.
    void initialLoad.then(
      ([page, spec]) => {
        settleUrl(page);
        shownFile = page.page?.file;
        trackPageError(page);
        setBoot({ page, spec });
      },
      (cause: unknown) => {
        setBoot(cause instanceof Error ? cause : new Error(String(cause)));
        setTimeout(reloadWhenServerAnswers, 1000);
      },
    );
  }, []);

  if (boot === undefined) return <BootLoading />;
  if (boot instanceof Error) {
    return (
      <StatusPage
        tone="danger"
        icon={PlugOff}
        title="Can't reach the diffmap server"
        actions={<RetryButton />}
      >
        <P>
          The server that opened this page isn't answering. Run diffmap serve
          again and this page reloads on its own.
        </P>
      </StatusPage>
    );
  }
  return (
    <LocalViewer
      initialPage={boot.page}
      spec={"error" in boot.spec ? undefined : boot.spec}
    />
  );
}

/** Blank until 2s pass, so a fast local load never flashes a spinner. */
function BootLoading() {
  const className = useStyles(styles.boot);
  return (
    <div className={className}>
      <LoadingScreen />
    </div>
  );
}

function LocalViewer(props: { initialPage: PageLoad; spec: Spec | undefined }) {
  const [load, setLoad] = useState(props.initialPage);
  const [pageLoading, setPageLoading] = useState(false);
  const spec = props.spec;

  const show = (segment: string, commit?: (next: PageLoad) => void) => {
    setPageLoading(true);
    // oxlint-disable-next-line typescript/no-floating-promises -- Navigation owns this load.
    void loadPage(segment).then(
      (next) => {
        setPageLoading(false);
        commit?.(next);
        if (next.page?.file === shownFile && next.viewerDocument !== undefined)
          return;
        trackPageError(next);
        shownFile = next.page?.file;
        setLoad(next);
      },
      // The reload socket reports a stopped server; the current page stays up.
      () => setPageLoading(false),
    );
  };

  // Back and forward load the page the URL names; a jump to a heading on the same page stays put.
  const onPop = useEffectEvent(() => show(pageSegment()));
  useEffect(() => {
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const current =
    spec?.pages.find((candidate) => candidate.file === load.page?.file) ??
    load.page;
  if (load.missingPage !== undefined) {
    return (
      <StatusPage
        tone="neutral"
        icon={FileSearch}
        title="Page not found"
        actions={
          <StatusLink href="/" variant="primary">
            Go to the cover page
          </StatusLink>
        }
        footer={spec !== undefined && <PageList pages={spec.pages} />}
      >
        <P>
          This spec has no page at /{load.missingPage}. It may have been renamed
          or removed since this link was made.
        </P>
      </StatusPage>
    );
  }
  if (load.specError !== undefined) {
    return (
      <StatusPage
        tone="danger"
        icon={FileError}
        title="Can't read this spec"
        detail={load.specError}
      >
        <P>
          diffmap couldn't read the spec it's serving. Fix the problem below;
          this page reloads when the spec's files change.
        </P>
      </StatusPage>
    );
  }
  if (load.viewerDocument === undefined) {
    return (
      <SpecErrorPage
        title="This page has an error"
        file={load.page?.file ?? "This page"}
        message={load.parseError ?? "Unknown parse error."}
      >
        <P>
          Fix the problem below and save the file. This page reloads on its own.
        </P>
      </SpecErrorPage>
    );
  }
  return (
    <MediaResolverContext.Provider value={localMediaUrl}>
      <ViewerApp
        // Each page has its own comments, Reviewed files, and Diff panel.
        key={current?.file}
        document={load.viewerDocument}
        mode="local"
        pageLoading={pageLoading}
        spec={
          spec === undefined || current === undefined
            ? undefined
            : {
                title: spec.title,
                pages: spec.pages,
                current,
                href: pageHref,
                navigate: (page, hash) =>
                  show(page.slug, () =>
                    window.history.pushState(
                      {},
                      "",
                      `${pageHref(page)}${hash}`,
                    ),
                  ),
              }
        }
      />
    </MediaResolverContext.Provider>
  );
}

function PageList(props: { pages: SpecPage[] }) {
  return (
    <Flex column gap={3} pt={6}>
      <Label>Pages in this spec</Label>
      {props.pages.map((page) => (
        <Link key={page.file} href={pageHref(page)}>
          {page.title}
        </Link>
      ))}
    </Flex>
  );
}

const styles = {
  boot: style({ display: "flex", width: "100%", height: "100vh" }),
};

createRoot(root).render(
  <StrictMode>
    <MauiProvider>
      <LocalApp />
    </MauiProvider>
  </StrictMode>,
);
