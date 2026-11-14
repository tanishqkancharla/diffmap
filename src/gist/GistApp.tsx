import { useEffect, useState } from "react";
import { Button, FileSearch, FileText, Link, LinkBreak, P } from "maui";
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
import {
  SpecErrorPage,
  StatusCode,
  StatusLink,
  StatusLoading,
  StatusPage,
} from "../viewer/StatusPage.tsx";
import { GitHubFailurePage } from "../host/GitHubFailurePage.tsx";
import type { GitHubFailure } from "../host/githubFailure.ts";
import {
  githubGistUrl,
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
  | { kind: "failed"; failure: GitHubFailure }
  | { kind: "no-markdown"; htmlUrl: string }
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
            kind: "failed",
            failure: {
              status: "error",
              message:
                cause instanceof Error
                  ? cause.message
                  : "Failed to load this gist.",
            },
          },
        });
      },
    );
    return () => abort.abort();
  }, [gistId]);

  if (route.kind === "home") return <Landing />;
  if (route.kind === "invalid") {
    return (
      <StatusPage
        tone="neutral"
        icon={LinkBreak}
        title="This isn't a gist link"
        detail={<StatusCode>{`diffmap.dev/g/${route.value}`}</StatusCode>}
        actions={<StatusLink href="/">Go to diffmap.dev</StatusLink>}
      >
        <P>
          A gist link ends in the 32-character id from the gist's GitHub
          address, such as diffmap.dev/g/1a2b3c…. This one has something else
          there, so check that the whole link was copied.
        </P>
      </StatusPage>
    );
  }

  if (route.kind !== "gist" || loaded === undefined || loaded.gistId !== gistId)
    return <StatusLoading label="Loading gist from GitHub" />;
  const view = loaded.view;
  if (view.kind === "failed") {
    return (
      <GitHubFailurePage
        failure={view.failure}
        noun="gist"
        githubUrl={githubGistUrl(route.gistId)}
        githubLabel="Open gist on GitHub"
        notFound={
          <P>
            GitHub has no public gist with this id. It may have been deleted, or
            the link may be missing characters.
          </P>
        }
      />
    );
  }
  if (view.kind === "no-markdown") {
    return (
      <StatusPage
        tone="neutral"
        icon={FileText}
        title="Nothing to show in this gist"
        actions={
          <StatusLink href={view.htmlUrl}>Open gist on GitHub</StatusLink>
        }
      >
        <P>
          diffmap shows a gist's Markdown files, and this one has no .md or .mdx
          file.
        </P>
      </StatusPage>
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
      <StatusPage
        tone="neutral"
        icon={FileSearch}
        title="File not found"
        actions={
          <StatusLink href={gist.htmlUrl}>Open gist on GitHub</StatusLink>
        }
        footer={<FileLinks gistId={gist.id} files={gist.files} />}
      >
        <P>
          This gist has no Markdown file named {props.file}. Open one of its
          files below instead.
        </P>
      </StatusPage>
    );
  }
  if (document instanceof Error) {
    return (
      <SpecErrorPage
        file={chosen.name}
        message={document.message}
        actions={
          <StatusLink href={gist.htmlUrl}>Open gist on GitHub</StatusLink>
        }
      >
        <P>
          diffmap couldn't show this walkthrough. Ask the agent that wrote it to
          fix the problem below, then share it again.
        </P>
      </SpecErrorPage>
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
  if (loaded.status === "no-markdown") {
    return { kind: "no-markdown", htmlUrl: loaded.htmlUrl };
  }
  if (loaded.status !== "ok") return { kind: "failed", failure: loaded };
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
