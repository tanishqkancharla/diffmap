import { useEffect, useState } from "react";
import { Link, P } from "maui";
import { init } from "md4x/standalone";
import { parseViewerDocument } from "../parseViewer.ts";
import type { ViewerDocument } from "../parseViewer.ts";
import { ViewerApp } from "../viewer/ViewerApp.tsx";
import { GistLoading, GistStatus } from "../gist/GistStatus.tsx";
import { fetchGitHubChanges } from "../github/fetchRepo.ts";
import {
  ChangesLoaderContext,
  type ChangesLoader,
} from "../viewer/changesSource.ts";
import { HostFilesContext } from "./files.ts";
import homeSource from "./home.md?raw";
import shareSource from "../share.ts?raw";
import serveSource from "../serve.ts?raw";
import gitSource from "../git.ts?raw";
import fetchRepoSource from "../github/fetchRepo.ts?raw";
import fenceSource from "../viewer/Fence.tsx?raw";
import callStackSource from "../viewer/CallStackDiff.tsx?raw";
import sourceNavigationSource from "../viewer/sourceNavigation.ts?raw";
import sourceDiffPanelSource from "../viewer/SourceDiffPanel.tsx?raw";
import viewerAppSource from "../viewer/ViewerApp.tsx?raw";
import parseFenceSource from "../parseFence.ts?raw";
import annotationsSource from "../annotations.ts?raw";
import hostFilesSource from "./files.ts?raw";

let parserReady: Promise<void> | undefined;

function readyHostParser() {
  parserReady ??= init();
  return parserReady;
}

const hostFiles = {
  "src/share.ts": shareSource,
  "src/serve.ts": serveSource,
  "src/git.ts": gitSource,
  "src/github/fetchRepo.ts": fetchRepoSource,
  "src/viewer/Fence.tsx": fenceSource,
  "src/viewer/CallStackDiff.tsx": callStackSource,
  "src/viewer/sourceNavigation.ts": sourceNavigationSource,
  "src/viewer/SourceDiffPanel.tsx": sourceDiffPanelSource,
  "src/viewer/ViewerApp.tsx": viewerAppSource,
  "src/parseFence.ts": parseFenceSource,
  "src/annotations.ts": annotationsSource,
  "src/host/files.ts": hostFilesSource,
};

/** The homepage walks through diffmap's own commits, read from GitHub. */
const loadHostChanges: ChangesLoader = (rev) =>
  fetchGitHubChanges({ owner: "tanishqkancharla", repo: "diffmap" }, rev);

export function HostHome() {
  const [view, setView] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; document: ViewerDocument }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    // oxlint-disable-next-line typescript/no-floating-promises -- The effect owns this parse; ignore after unmount.
    void readyHostParser().then(() => {
      if (cancelled) return;
      const parsed = parseViewerDocument(homeSource, "home.md");
      if (parsed instanceof Error) {
        setView({ kind: "error", message: parsed.message });
        return;
      }
      setView({ kind: "ready", document: parsed });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (view.kind === "loading") return <GistLoading title="Loading…" />;
  if (view.kind === "error") {
    return (
      <GistStatus title="Could not parse this walkthrough">
        <P>{view.message}</P>
      </GistStatus>
    );
  }

  return (
    <HostFilesContext.Provider value={hostFiles}>
      <ChangesLoaderContext.Provider value={loadHostChanges}>
        <ViewerApp
          document={view.document}
          mode="host"
          headerActions={
            <Link href="https://github.com/tanishqkancharla/diffmap">
              GitHub
            </Link>
          }
        />
      </ChangesLoaderContext.Provider>
    </HostFilesContext.Provider>
  );
}
