import { useEffect, useState } from "react";
import { Link, P } from "maui";
import { init } from "md4x/standalone";
import { parseViewerDocument } from "../parseViewer.ts";
import type { ViewerDocument } from "../parseViewer.ts";
import { ViewerApp } from "../viewer/ViewerApp.tsx";
import { GistLoading, GistStatus } from "../gist/GistStatus.tsx";
import { loadPinnedSpec, type PinnedSpec } from "./fetchRepo.ts";
import { GitHubPinContext } from "./pin.ts";
import {
  githubBlobUrl,
  githubCommitPath,
  githubPullUrl,
  parseGitHubPath,
  type GitHubRoute,
} from "./route.ts";

let parserReady: Promise<void> | undefined;

function readyParser() {
  parserReady ??= init();
  return parserReady;
}

type GitHubView =
  | { kind: "not-found" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "parse-error"; htmlUrl: string; message: string }
  | { kind: "ready"; spec: PinnedSpec; document: ViewerDocument };

export function GitHubApp() {
  const [route, setRoute] = useState(readGitHubRoute);
  const routeKey = gitHubRouteKey(route);
  const [loaded, setLoaded] = useState<{ key: string; view: GitHubView }>();

  useEffect(() => {
    const onPop = () => setRoute(readGitHubRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (route.kind === "github-invalid") return;
    const key = gitHubRouteKey(route);
    const abort = new AbortController();
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns this load; abort on cleanup.
    void loadView(route, abort.signal).then(
      (next) => {
        if (!abort.signal.aborted) setLoaded({ key, view: next });
      },
      (cause: unknown) => {
        if (abort.signal.aborted) return;
        setLoaded({
          key,
          view: {
            kind: "error",
            message:
              cause instanceof Error
                ? cause.message
                : "Failed to load this spec.",
          },
        });
      },
    );
    return () => abort.abort();
  }, [route]);

  if (route.kind === "github-invalid") {
    return (
      <GistStatus title="Not a hosted spec">
        <P>{route.message}</P>
        <P>
          Use{" "}
          <code>
            /&lt;owner&gt;/&lt;repo&gt;/pull/&lt;n&gt;/&lt;path.md&gt;
          </code>{" "}
          or{" "}
          <code>
            /&lt;owner&gt;/&lt;repo&gt;/commit/&lt;sha&gt;/&lt;path.md&gt;
          </code>
          .
        </P>
      </GistStatus>
    );
  }

  if (loaded === undefined || loaded.key !== routeKey) {
    return <GistLoading title="Loading spec…" />;
  }
  const view = loaded.view;
  if (view.kind === "not-found") {
    return (
      <GistStatus title="Spec not found">
        <P>
          GitHub has no public file at this pull or commit. Private repos are
          out of scope.
        </P>
      </GistStatus>
    );
  }
  if (view.kind === "forbidden") {
    return (
      <GistStatus title="Failed to load">
        <P>
          GitHub refused this request. Unauthenticated API calls are limited to
          60 per hour per IP. Wait and refresh, or open the file on GitHub.
        </P>
      </GistStatus>
    );
  }
  if (view.kind === "error") {
    return (
      <GistStatus title="Failed to load">
        <P>{view.message}</P>
      </GistStatus>
    );
  }
  if (view.kind === "parse-error") {
    return (
      <GistStatus
        title="Could not parse this walkthrough"
        gistUrl={view.htmlUrl}
        linkLabel="Open file on GitHub"
      >
        <P>{view.message}</P>
      </GistStatus>
    );
  }

  const spec = view.spec;
  return (
    <GitHubPinContext.Provider value={spec}>
      <ViewerApp
        key={`${spec.owner}/${spec.repo}@${spec.sha}:${spec.path}`}
        document={view.document}
        mode="github"
        headerActions={
          <GitHubHeader
            owner={spec.owner}
            repo={spec.repo}
            sha={spec.sha}
            path={spec.path}
            pullNumber={spec.pullNumber}
            pullUrl={spec.pullUrl}
          />
        }
      />
    </GitHubPinContext.Provider>
  );
}

async function loadView(
  route: Exclude<GitHubRoute, { kind: "github-invalid" }>,
  signal: AbortSignal,
): Promise<GitHubView> {
  await readyParser();
  const loaded = await loadPinnedSpec({
    owner: route.owner,
    repo: route.repo,
    path: route.path,
    sha: route.kind === "github-commit" ? route.sha : undefined,
    pull: route.kind === "github-pull" ? route.pull : undefined,
    signal,
  });
  if (loaded.status === "not-found") return { kind: "not-found" };
  if (loaded.status === "forbidden") return { kind: "forbidden" };
  if (loaded.status === "error") {
    return { kind: "error", message: loaded.message };
  }

  const spec = loaded.spec;
  if (route.kind === "github-pull") {
    const pinned = githubCommitPath(spec.owner, spec.repo, spec.sha, spec.path);
    if (window.location.pathname !== pinned) {
      window.history.replaceState({}, "", `${pinned}${window.location.hash}`);
    }
  }

  const parsed = parseViewerDocument(spec.content, spec.path);
  if (parsed instanceof Error) {
    return {
      kind: "parse-error",
      htmlUrl: spec.htmlUrl,
      message: parsed.message,
    };
  }
  const document =
    parsed.sourceDiffs.length > 0
      ? parsed
      : { ...parsed, sourceDiffs: spec.pullDiffs };
  return { kind: "ready", spec, document };
}

function readGitHubRoute(): GitHubRoute {
  const parsed = parseGitHubPath(window.location.pathname);
  if (parsed.kind === "home") {
    return {
      kind: "github-invalid",
      message: "Not a GitHub-hosted spec URL.",
    };
  }
  return parsed;
}

function gitHubRouteKey(route: GitHubRoute) {
  if (route.kind === "github-invalid") return `invalid:${route.message}`;
  if (route.kind === "github-pull") {
    return `pull:${route.owner}/${route.repo}/${String(route.pull)}/${route.path}`;
  }
  return `commit:${route.owner}/${route.repo}/${route.sha}/${route.path}`;
}

function GitHubHeader(props: {
  owner: string;
  repo: string;
  sha: string;
  path: string;
  pullNumber?: number;
  pullUrl?: string;
}) {
  const shortSha = props.sha.slice(0, 7);
  const blobUrl = githubBlobUrl(props.owner, props.repo, props.sha, props.path);
  const pullHref =
    props.pullUrl ??
    (props.pullNumber === undefined
      ? undefined
      : githubPullUrl(props.owner, props.repo, props.pullNumber));
  return (
    <>
      {pullHref !== undefined && <Link href={pullHref}>PR</Link>}
      <Link href={blobUrl}>{`${props.owner}/${props.repo}@${shortSha}`}</Link>
    </>
  );
}
