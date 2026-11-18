import { useEffect, useState, type ReactNode } from "react";
import { FileSearch, P } from "maui";
import { init } from "md4x/standalone";
import { WORKING, type Changes, type Rev } from "../../changes.ts";
import { HostFilesContext, type HostFiles } from "../../host/files.ts";
import { parseViewerDocument } from "../../parseViewer.ts";
import { findPage, makeSpec, type Spec, type SpecPage } from "../../spec.ts";
import { ChangesLoaderContext } from "../../viewer/changesSource.ts";
import { MediaResolverContext } from "../../viewer/Media.tsx";
import {
  PreviewsSourceContext,
  type PreviewsSource,
} from "../../viewer/previews/config.ts";
import {
  SpecErrorPage,
  StatusLink,
  StatusLoading,
  StatusPage,
} from "../../viewer/StatusPage.tsx";
import { ViewerApp } from "../../viewer/ViewerApp.tsx";
import { ProductdocWordmark } from "../../viewer/share/ProductdocWordmark.tsx";
import { SharedPage } from "../../viewer/share/SharedPage.tsx";
import {
  blobUrl,
  isDocumentId,
  type DocumentInfo,
  type Manifest,
} from "../protocol.ts";
import { getJson } from "./api.ts";

/** Previews and flows run only in a local viewer until productdoc.dev hosts them. */
const noPreviews: PreviewsSource = {
  load: () => Promise.resolve({ config: {} }),
};

type Loaded = {
  info: DocumentInfo;
  spec: Spec<SpecPage & { source: string }> | Error | undefined;
  changes: Record<Rev, Changes>;
  files: HostFiles;
};

type View =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "failed"; message: string }
  | { kind: "ready"; loaded: Loaded };

/** productdoc.dev/d/<id>/<page>: a shared document in the hosted viewer. */
export function SharedApp() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [, , id = "", slug = ""] = path.split("/");
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!isDocumentId(id)) return;
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns this load.
    void loadDocument(id).then(setView);
  }, [id]);

  if (!isDocumentId(id) || view.kind === "missing") {
    return <Missing />;
  }
  if (view.kind === "loading")
    return <StatusLoading label="Loading document" />;
  if (view.kind === "failed") {
    return (
      <SpecErrorPage
        file={id}
        message={view.message}
        actions={<StatusLink href={path}>Try again</StatusLink>}
      >
        <P>productdoc couldn&apos;t load this document.</P>
      </SpecErrorPage>
    );
  }
  const { info, spec } = view.loaded;
  const shell = (viewer: (actions: ReactNode) => ReactNode) => (
    <SharedPage
      owner={info.owner}
      status={info.status}
      access="public"
      reader={undefined}
      people={[]}
      versions={undefined}
      api={{ signIn: () => new Promise(() => {}) }}
      viewer={viewer}
    />
  );
  if (info.status !== "shared" || spec === undefined)
    return shell(() => undefined);
  if (spec instanceof Error) {
    return (
      <SpecErrorPage file={id} message={spec.message}>
        <P>
          Ask the agent that shared it to fix the problem below, then share it
          again.
        </P>
      </SpecErrorPage>
    );
  }
  const page = findPage(spec, slug) ?? spec.pages[0];
  if (page === undefined) return shell(() => undefined);
  const document = parseViewerDocument(page.source, page.file);
  if (document instanceof Error) {
    return (
      <SpecErrorPage file={page.file} message={document.message}>
        <P>
          Ask the agent that shared it to fix the problem below, then share it
          again.
        </P>
      </SpecErrorPage>
    );
  }
  const href = (target: SpecPage) =>
    target.slug === "" ? `/d/${id}` : `/d/${id}/${target.slug}`;
  const manifest = info.manifest!;
  const changes = view.loaded.changes;
  return shell((headerActions) => (
    <PreviewsSourceContext.Provider value={noPreviews}>
      <MediaResolverContext.Provider
        value={(src) => mediaUrl(id, manifest, src)}
      >
        <HostFilesContext.Provider value={view.loaded.files}>
          <ChangesLoaderContext.Provider
            value={(rev) =>
              Promise.resolve(
                changes[rev] ??
                  new Error(
                    rev === WORKING
                      ? "Uncommitted changes are only available in a local viewer."
                      : `This document has no snapshot of ${rev}. Share it again with product-doc share.`,
                  ),
              )
            }
          >
            <ViewerApp
              key={page.file}
              document={document}
              mode="host"
              headerActions={headerActions}
              spec={
                spec.pages.length > 1
                  ? {
                      title: spec.title,
                      pages: spec.pages,
                      current: page,
                      href,
                      navigate: (next, hash) => {
                        window.history.pushState(
                          {},
                          "",
                          `${href(next)}${hash}`,
                        );
                        setPath(window.location.pathname);
                      },
                    }
                  : undefined
              }
            />
          </ChangesLoaderContext.Provider>
        </HostFilesContext.Provider>
      </MediaResolverContext.Provider>
    </PreviewsSourceContext.Provider>
  ));
}

async function loadDocument(id: string): Promise<View> {
  const [response] = await Promise.all([
    fetch(`/api/documents/${id}`).catch(() => undefined),
    init(),
  ]);
  if (response?.status === 404) return { kind: "missing" };
  if (response === undefined || !response.ok)
    return {
      kind: "failed",
      message: "productdoc.dev can't be reached right now.",
    };
  const info = (await response.json()) as DocumentInfo;
  const manifest = info.manifest;
  if (info.status !== "shared" || manifest === undefined)
    return {
      kind: "ready",
      loaded: { info, spec: undefined, changes: {}, files: {} },
    };
  const pages = await Promise.all(
    Object.entries(manifest.pages).map(async ([file, ref]) => ({
      file,
      source: await (await fetch(blobUrl(id, ref.hash))).text(),
    })),
  );
  const [changes, files] = await Promise.all([
    manifest.changes === undefined
      ? {}
      : getJson(blobUrl(id, manifest.changes.hash)),
    manifest.files === undefined
      ? {}
      : getJson(blobUrl(id, manifest.files.hash)),
  ]);
  return {
    kind: "ready",
    loaded: {
      info,
      spec: makeSpec(manifest.title, pages),
      changes:
        changes instanceof Error ? {} : (changes as Record<Rev, Changes>),
      files: files instanceof Error ? {} : (files as HostFiles),
    },
  };
}

/** A path written in a page, such as `shots/login.png`, as the blob the manifest stored for it. */
function mediaUrl(id: string, manifest: Manifest, src: string) {
  const path = src.replace(/^\.\//, "").split(/[?#]/)[0] ?? src;
  const ref = manifest.media[decodeURIComponent(path)];
  return ref === undefined ? src : blobUrl(id, ref.hash);
}

function Missing() {
  return (
    <StatusPage
      wordmark={<ProductdocWordmark />}
      tone="neutral"
      icon={FileSearch}
      title="No document is shared here"
      actions={<StatusLink href="/">Go to productdoc.dev</StatusLink>}
    >
      <P>Check that the whole link was copied.</P>
    </StatusPage>
  );
}
