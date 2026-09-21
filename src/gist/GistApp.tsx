import { useEffect, useState } from "react";
import { Button, Link, P } from "maui";
import { style, useStyles } from "purse-styles";
import { init } from "md4x/standalone";
import { parseViewerDocument } from "../parseViewer.ts";
import type { ViewerDocument } from "../parseViewer.ts";
import { ViewerApp } from "../viewer/ViewerApp.tsx";
import { loadGistMarkdown, type GistDocument } from "./fetchGist.ts";
import { GistPinContext } from "./pin.ts";
import { HostHome } from "../host/HostHome.tsx";
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
  | {
      kind: "missing-file";
      gistId: string;
      htmlUrl: string;
      files: { name: string }[];
      file: string;
    }
  | { kind: "error"; gistId: string; message: string }
  | { kind: "parse-error"; gistId: string; htmlUrl: string; message: string }
  | {
      kind: "ready";
      gist: GistDocument;
      file: string;
      document: ViewerDocument;
    };

export function GistApp() {
  const [route, setRoute] = useState(readRoute);
  const gistKey =
    route.kind === "gist" ? `${route.gistId}:${route.file ?? ""}` : undefined;
  const [loaded, setLoaded] = useState<{ key: string; view: GistView }>();

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (route.kind !== "gist") return;
    const gistId = route.gistId;
    const file = route.file;
    const key = `${gistId}:${file ?? ""}`;
    const abort = new AbortController();
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns this load; abort on cleanup.
    void loadView(gistId, file, abort.signal).then(
      (next) => {
        if (!abort.signal.aborted) setLoaded({ key, view: next });
      },
      (cause: unknown) => {
        if (abort.signal.aborted) return;
        setLoaded({
          key,
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
  }, [route]);

  if (route.kind === "home") return <HostHome />;
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

  if (loaded === undefined || loaded.key !== gistKey) return <GistLoading />;
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
  if (view.kind === "missing-file") {
    return (
      <GistStatus title="File not found" gistUrl={view.htmlUrl}>
        <P>
          <code>{view.file}</code> is not a markdown file in this gist.
        </P>
        <FileLinks gistId={view.gistId} files={view.files} />
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
  if (view.kind === "parse-error") {
    return (
      <GistStatus
        title="Could not parse this walkthrough"
        gistUrl={view.htmlUrl}
      >
        <P>{view.message}</P>
      </GistStatus>
    );
  }

  return (
    <GistPinContext.Provider
      value={{
        gistId: view.gist.id,
        file: view.file,
        htmlUrl: view.gist.htmlUrl,
      }}
    >
      <ViewerApp
        key={`${view.gist.id}:${view.file}`}
        document={view.document}
        mode="gist"
        headerActions={
          <GistHeader
            gistId={view.gist.id}
            htmlUrl={view.gist.htmlUrl}
            files={view.gist.files}
            current={view.file}
            onSelect={(file) => {
              const next = gistPath(view.gist.id, file);
              window.history.pushState({}, "", next);
              setRoute(parseGistPath(next));
            }}
          />
        }
      />
    </GistPinContext.Provider>
  );
}

async function loadView(
  gistId: string,
  file: string | undefined,
  signal: AbortSignal,
): Promise<GistView> {
  await readyGistParser();
  const loaded = await loadGistMarkdown(gistId, file, signal);
  if (loaded.status === "not-found") return { kind: "not-found", gistId };
  if (loaded.status === "forbidden") return { kind: "forbidden", gistId };
  if (loaded.status === "error") {
    return { kind: "error", gistId, message: loaded.message };
  }
  if (loaded.status === "no-markdown") {
    return { kind: "no-markdown", gistId, htmlUrl: loaded.htmlUrl };
  }
  if (loaded.status === "missing-file") {
    return {
      kind: "missing-file",
      gistId,
      htmlUrl: loaded.htmlUrl,
      files: loaded.files,
      file: file ?? "",
    };
  }
  const parsed = parseViewerDocument(
    loaded.gist.chosen.content,
    loaded.gist.chosen.name,
  );
  if (parsed instanceof Error) {
    return {
      kind: "parse-error",
      gistId,
      htmlUrl: loaded.gist.htmlUrl,
      message: parsed.message,
    };
  }
  return {
    kind: "ready",
    gist: loaded.gist,
    file: loaded.gist.chosen.name,
    document: parsed,
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
