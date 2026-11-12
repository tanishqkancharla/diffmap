import { useEffect, useState } from "react";
import { Button, Link, P } from "maui";
import { style, useStyles } from "purse-styles";
import { init } from "md4x/standalone";
import { parseViewerDocument } from "../parseViewer.ts";
import { WORKING } from "../changes.ts";
import {
  ChangesLoaderContext,
  type ChangesLoader,
} from "../viewer/changesSource.ts";
import { ViewerApp } from "../viewer/ViewerApp.tsx";
import type { SpecPage } from "../spec.ts";
import {
  chooseGistFile,
  loadGistMarkdown,
  type GistDocument,
} from "./fetchGist.ts";
import { GistPinContext } from "./pin.ts";
import { Landing } from "../landing/Landing.tsx";
import { HostFilesContext } from "../host/files.ts";
import { GistLoading, GistStatus } from "./GistStatus.tsx";
import {
  gistPath,
  parseGistPath,
  rewritePiGistUrl,
  type GistRoute,
} from "./route.ts";

let parserReady: Promise<void> | undefined;

function readyGistParser() {
  parserReady ??= init();
  return parserReady;
}

type GistView =
  | { kind: "not-found"; gistId: string }
  | { kind: "forbidden"; gistId: string }
  | { kind: "no-markdown"; gistId: string; htmlUrl: string }
  | { kind: "error"; gistId: string; message: string }
  | { kind: "ready"; gist: GistDocument; loadChanges: ChangesLoader };

export function GistApp() {
  const [route, setRoute] = useState(readRoute);
  const gistId = route.kind === "gist" ? route.gistId : undefined;
  // A gist loads once; moving between its files or pages only changes the route.
  const [loaded, setLoaded] = useState<{ gistId: string; view: GistView }>();

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (gistId === undefined) return;
    const abort = new AbortController();
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns this load; abort on cleanup.
    void loadView(gistId, abort.signal).then(
      (next) => {
        if (!abort.signal.aborted) setLoaded({ gistId, view: next });
      },
      (cause: unknown) => {
        if (abort.signal.aborted) return;
        setLoaded({
          gistId,
          view: {
            kind: "error",
            gistId,
            message:
              cause instanceof Error
                ? cause.message
                : "Failed to load this gist.",
          },
        });
      },
    );
    return () => abort.abort();
  }, [gistId]);

  if (route.kind === "home") return <Landing />;
  if (route.kind === "invalid") {
    return (
      <GistStatus title="Not a gist id">
        <P>
          <code>{route.value}</code> is not a 32-character GitHub gist id. Use
          the path <code>/g/&lt;gistId&gt;</code>.
        </P>
      </GistStatus>
    );
  }

  if (route.kind !== "gist" || loaded === undefined || loaded.gistId !== gistId)
    return <GistLoading />;
  const view = loaded.view;
  if (view.kind === "not-found") {
    return (
      <GistStatus title="Gist not found" gistId={view.gistId}>
        <P>GitHub has no gist with this id, or it is no longer available.</P>
      </GistStatus>
    );
  }
  if (view.kind === "forbidden") {
    return (
      <GistStatus title="Failed to load" gistId={view.gistId}>
        <P>
          GitHub refused this request. Unauthenticated API calls are limited to
          60 per hour per IP. Wait and refresh, or open the gist on GitHub.
        </P>
      </GistStatus>
    );
  }
  if (view.kind === "no-markdown") {
    return (
      <GistStatus title="No markdown" gistUrl={view.htmlUrl}>
        <P>
          This gist has no <code>.md</code> or <code>.mdx</code> file.
        </P>
      </GistStatus>
    );
  }
  if (view.kind === "error") {
    return (
      <GistStatus title="Failed to load" gistId={view.gistId}>
        <P>{view.message}</P>
      </GistStatus>
    );
  }
  return (
    <GistPage
      gist={view.gist}
      loadChanges={view.loadChanges}
      file={route.file}
      onRoute={(next, hash) => {
        window.history.pushState({}, "", `${next}${hash}`);
        setRoute(parseGistPath(next));
      }}
    />
  );
}

/** One file of a loaded gist, or one page when the gist is a spec. */
function GistPage(props: {
  gist: GistDocument;
  loadChanges: ChangesLoader;
  file: string | undefined;
  onRoute: (path: string, hash: string) => void;
}) {
  const gist = props.gist;
  const chosen = chooseGistFile(gist, props.file);
  // Parsing runs only when the route or the gist changes; the viewer keeps its own state.
  const document =
    chosen === undefined
      ? undefined
      : parseViewerDocument(chosen.content, chosen.name);
  const pageHref = (page: SpecPage) =>
    gistPath(gist.id, page.slug === "" ? undefined : page.slug);
  const canonical =
    chosen?.page === undefined ? undefined : pageHref(chosen.page);
  // A link to a page's file, such as /g/<id>/02-write-through.md, settles on the page's own URL.
  useEffect(() => {
    if (canonical !== undefined && window.location.pathname !== canonical) {
      window.history.replaceState(
        window.history.state,
        "",
        `${canonical}${window.location.hash}`,
      );
    }
  }, [canonical]);

  if (chosen === undefined || document === undefined) {
    return (
      <GistStatus title="File not found" gistUrl={gist.htmlUrl}>
        <P>
          <code>{props.file}</code> is not a markdown file in this gist.
        </P>
        <FileLinks gistId={gist.id} files={gist.files} />
      </GistStatus>
    );
  }
  if (document instanceof Error) {
    return (
      <GistStatus
        title="Could not parse this walkthrough"
        gistUrl={gist.htmlUrl}
      >
        <P>{document.message}</P>
      </GistStatus>
    );
  }
  const spec = gist.spec;
  const multiPage =
    spec !== undefined && chosen.page !== undefined && spec.pages.length > 1;
  return (
    <GistPinContext.Provider
      value={{
        gistId: gist.id,
        file: chosen.name,
        htmlUrl: gist.htmlUrl,
      }}
    >
      <HostFilesContext.Provider value={gist.sourceFiles}>
        <ChangesLoaderContext.Provider value={props.loadChanges}>
          <ViewerApp
            key={`${gist.id}:${chosen.name}`}
            document={document}
            mode="gist"
            spec={
              multiPage
                ? {
                    title: spec.title,
                    pages: spec.pages,
                    current: chosen.page,
                    href: pageHref,
                    navigate: (page, hash) =>
                      props.onRoute(pageHref(page), hash),
                  }
                : undefined
            }
            headerActions={
              <GistHeader
                gistId={gist.id}
                htmlUrl={gist.htmlUrl}
                // A spec moves between its pages from the page list instead.
                files={multiPage ? [] : gist.files}
                current={chosen.name}
                onSelect={(file) => props.onRoute(gistPath(gist.id, file), "")}
              />
            }
          />
        </ChangesLoaderContext.Provider>
      </HostFilesContext.Provider>
    </GistPinContext.Provider>
  );
}

async function loadView(
  gistId: string,
  signal: AbortSignal,
): Promise<GistView> {
  await readyGistParser();
  const loaded = await loadGistMarkdown(gistId, signal);
  if (loaded.status === "not-found") return { kind: "not-found", gistId };
  if (loaded.status === "forbidden") return { kind: "forbidden", gistId };
  if (loaded.status === "error") {
    return { kind: "error", gistId, message: loaded.message };
  }
  if (loaded.status === "no-markdown") {
    return { kind: "no-markdown", gistId, htmlUrl: loaded.htmlUrl };
  }
  const snapshot = loaded.gist.changes;
  return {
    kind: "ready",
    gist: loaded.gist,
    loadChanges: (rev) =>
      Promise.resolve(
        snapshot[rev] ??
          new Error(
            rev === WORKING
              ? "Uncommitted changes are only available in a local viewer."
              : `This gist has no snapshot of ${rev}. Share the spec again with diffmap share.`,
          ),
      ),
  };
}

function readRoute(): GistRoute {
  const rewritten = rewritePiGistUrl(
    window.location.pathname,
    window.location.hash,
  );
  if (rewritten !== undefined) return parseGistPath(rewritten);
  const parsed = parseGistPath(window.location.pathname);
  if (parsed.kind === "empty") return { kind: "home" };
  return parsed;
}

function GistHeader(props: {
  gistId: string;
  htmlUrl: string;
  files: { name: string }[];
  current: string;
  onSelect: (file: string) => void;
}) {
  return (
    <>
      {props.files.length > 1 && (
        <FileLinks
          gistId={props.gistId}
          files={props.files}
          current={props.current}
          onSelect={props.onSelect}
        />
      )}
      <Link href={props.htmlUrl}>Gist</Link>
    </>
  );
}

function FileLinks(props: {
  gistId: string;
  files: { name: string }[];
  current?: string;
  onSelect?: (file: string) => void;
}) {
  const group = useStyles(fileStyles.group);
  return (
    <div className={group} aria-label="Markdown files">
      {props.files.map((file) => {
        const href = gistPath(props.gistId, file.name);
        const current = file.name === props.current;
        const select = props.onSelect;
        if (select === undefined) {
          return (
            <Link key={file.name} href={href}>
              {file.name}
            </Link>
          );
        }
        return (
          <Button
            key={file.name}
            variant={current ? "primary" : "quiet"}
            onClick={() => {
              select(file.name);
            }}
          >
            {file.name}
          </Button>
        );
      })}
    </div>
  );
}

const fileStyles = {
  group: style({
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    alignItems: "center",
  }),
};
