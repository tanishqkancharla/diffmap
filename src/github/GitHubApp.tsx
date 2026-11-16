import { useEffect, useState } from "react";
import { Flex, Link, LinkBreak, P } from "maui";
import { init } from "md4x/standalone";
import type { SpecPage } from "../spec.ts";
import { parseViewerDocument } from "../parseViewer.ts";
import type { ViewerDocument } from "../parseViewer.ts";
import { ViewerApp } from "../viewer/ViewerApp.tsx";
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
  ChangesLoaderContext,
  type ChangesLoader,
} from "../viewer/changesSource.ts";
import {
  fetchGitHubChanges,
  fetchPinnedConfig,
  loadPinnedSpec,
  type PinnedSpec,
} from "./fetchRepo.ts";
import {
  PreviewsSourceContext,
  type PreviewsSource,
} from "../viewer/previews/config.ts";
import { GitHubPinContext } from "./pin.ts";
import { MediaResolverContext } from "../viewer/Media.tsx";
import {
  githubBlobUrl,
  githubCommitPath,
  githubCommitUrl,
  githubPullUrl,
  parseGitHubPath,
  type GitHubRoute,
} from "./route.ts";

let parserReady: Promise<void> | undefined;

const pullsBySha = new Map<
  string,
  Pick<PinnedSpec, "pullNumber" | "pullUrl" | "pullRev" | "pullBranch">
>();

function readyParser() {
  parserReady ??= init();
  return parserReady;
}

type GitHubView =
  | { kind: "failed"; failure: GitHubFailure }
  | { kind: "parse-error"; htmlUrl: string; path: string; message: string }
  | {
      kind: "ready";
      spec: PinnedSpec;
      document: ViewerDocument;
      loadChanges: ChangesLoader;
      previews: PreviewsSource;
    };

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
            kind: "failed",
            failure: {
              status: "error",
              message:
                cause instanceof Error
                  ? cause.message
                  : "Failed to load this spec.",
            },
          },
        });
      },
    );
    return () => abort.abort();
  }, [route]);

  if (route.kind === "github-invalid") {
    return (
      <StatusPage
        tone="neutral"
        icon={LinkBreak}
        title="This isn't a spec link"
        detailTitle="diffmap.dev opens specs from links like"
        detail={
          <Flex column gap={2}>
            <StatusCode>diffmap.dev/owner/repo/pull/12/specs/name/</StatusCode>
            <StatusCode>
              diffmap.dev/owner/repo/commit/a1b2c3d/specs/name/
            </StatusCode>
          </Flex>
        }
        actions={<StatusLink href="/">Go to diffmap.dev</StatusLink>}
      >
        <P>{route.message} Check that the whole link was copied.</P>
      </StatusPage>
    );
  }

  // Moving to another page of a loaded spec keeps the current page up until the next one is ready.
  if (
    loaded === undefined ||
    (loaded.key !== routeKey && loaded.view.kind !== "ready")
  ) {
    return (
      <StatusLoading
        label={
          route.kind === "github-pull"
            ? `Loading ${route.owner}/${route.repo}#${String(route.pull)}`
            : `Loading ${route.owner}/${route.repo}@${route.sha.slice(0, 7)}`
        }
      />
    );
  }
  const view = loaded.view;
  if (view.kind === "failed") {
    const where =
      route.kind === "github-pull"
        ? `pull request #${String(route.pull)} of ${route.owner}/${route.repo}`
        : `commit ${route.sha.slice(0, 7)} of ${route.owner}/${route.repo}`;
    return (
      <GitHubFailurePage
        failure={view.failure}
        noun="spec"
        githubUrl={
          route.kind === "github-pull"
            ? githubPullUrl(route.owner, route.repo, route.pull)
            : githubCommitUrl(route.owner, route.repo, route.sha)
        }
        githubLabel={
          route.kind === "github-pull"
            ? "Open pull request on GitHub"
            : "Open commit on GitHub"
        }
        notFound={
          <P>
            GitHub has no public {route.path} in {where}. Check the path, and
            that the repository is public: diffmap.dev can't open private
            repositories.
          </P>
        }
      />
    );
  }
  if (view.kind === "parse-error") {
    return (
      <SpecErrorPage
        file={view.path}
        message={view.message}
        actions={
          <StatusLink href={view.htmlUrl}>Open file on GitHub</StatusLink>
        }
      >
        <P>
          diffmap couldn't show this spec. Ask the agent that wrote it to fix
          the problem below and push again.
        </P>
      </SpecErrorPage>
    );
  }

  const spec = view.spec;
  const pinned = spec.pages;
  const pagePath = (page: SpecPage) =>
    pinned === undefined || pinned.dir === ""
      ? page.file
      : `${pinned.dir}/${page.file}`;
  const pageHref = (page: SpecPage) =>
    githubCommitPath(spec.owner, spec.repo, spec.sha, pagePath(page));
  const current = pinned?.spec.pages.find(
    (page) => pagePath(page) === spec.path,
  );
  return (
    <GitHubPinContext.Provider value={spec}>
      <MediaResolverContext.Provider value={(src) => rawMediaUrl(spec, src)}>
        <ChangesLoaderContext.Provider value={view.loadChanges}>
          <PreviewsSourceContext.Provider value={view.previews}>
            <ViewerApp
              defaultRev={spec.pullRev}
              key={`${spec.owner}/${spec.repo}@${spec.sha}:${spec.path}`}
              document={view.document}
              mode="github"
              pageLoading={loaded.key !== routeKey}
              spec={
                pinned !== undefined && current !== undefined
                  ? {
                      title: pinned.spec.title,
                      pages: pinned.spec.pages,
                      current,
                      href: pageHref,
                      navigate: (page, hash) => {
                        window.history.pushState(
                          {},
                          "",
                          `${pageHref(page)}${hash}`,
                        );
                        setRoute(readGitHubRoute());
                      },
                    }
                  : undefined
              }
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
          </PreviewsSourceContext.Provider>
        </ChangesLoaderContext.Provider>
      </MediaResolverContext.Provider>
    </GitHubPinContext.Provider>
  );
}

/** Media beside the spec, at the pinned commit. */
function rawMediaUrl(spec: PinnedSpec, src: string) {
  const specUrl = `https://raw.githubusercontent.com/${spec.owner}/${spec.repo}/${spec.sha}/${spec.path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  return new URL(src, specUrl).href;
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
  if (loaded.status !== "ok") return { kind: "failed", failure: loaded };

  // The pull request a commit was pinned from, so its other pages, opened by commit URL, keep the PR link and diff.
  const spec =
    route.kind === "github-pull"
      ? loaded.spec
      : { ...loaded.spec, ...pullsBySha.get(loaded.spec.sha) };
  if (route.kind === "github-pull") {
    pullsBySha.set(spec.sha, {
      pullNumber: spec.pullNumber,
      pullUrl: spec.pullUrl,
      pullRev: spec.pullRev,
      pullBranch: spec.pullBranch,
    });
  }
  // A pull request pins to its head commit, and a spec's directory to its cover page.
  const pinned = githubCommitPath(spec.owner, spec.repo, spec.sha, spec.path);
  if (window.location.pathname !== pinned) {
    window.history.replaceState({}, "", `${pinned}${window.location.hash}`);
  }

  const parsed = parseViewerDocument(spec.content, spec.path);
  if (parsed instanceof Error) {
    return {
      kind: "parse-error",
      htmlUrl: spec.htmlUrl,
      path: spec.path,
      message: parsed.message,
    };
  }
  return {
    kind: "ready",
    spec,
    document: parsed,
    loadChanges: (rev) => fetchGitHubChanges(spec, rev),
    previews: {
      load: () =>
        fetchPinnedConfig(
          spec,
          spec.pages?.dir ??
            spec.path.slice(0, Math.max(0, spec.path.lastIndexOf("/"))),
        ),
      deployment: {
        sha: spec.sha,
        branch: spec.pullBranch,
        pull: spec.pullNumber,
      },
    },
  };
}

function readGitHubRoute(): GitHubRoute {
  const parsed = parseGitHubPath(window.location.pathname);
  if (parsed.kind === "home") {
    return {
      kind: "github-invalid",
      message: "This isn't a link to a spec on GitHub.",
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
