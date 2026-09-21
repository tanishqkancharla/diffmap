import { useEffect, useState } from "react";
import { Link, P } from "maui";
import { init } from "md4x/standalone";
import { parseViewerDocument } from "../parseViewer.ts";
import type { ViewerDocument } from "../parseViewer.ts";
import { ViewerApp } from "../viewer/ViewerApp.tsx";
import { GistLoading, GistStatus } from "../gist/GistStatus.tsx";
import { HostFilesContext } from "./files.ts";
import homeSource from "./home.md?raw";
import cliSource from "../cli.ts?raw";
import shareSource from "../share.ts?raw";
import parseViewerSource from "../parseViewer.ts?raw";
import githubRouteSource from "../github/route.ts?raw";

let parserReady: Promise<void> | undefined;

function readyHostParser() {
  parserReady ??= init();
  return parserReady;
}

const hostFiles = {
  "src/cli.ts": cliSource,
  "src/share.ts": shareSource,
  "src/parseViewer.ts": parseViewerSource,
  "src/github/route.ts": githubRouteSource,
};

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
      <ViewerApp
        document={view.document}
        mode="host"
        headerActions={
          <Link href="https://github.com/tanishqkancharla/diffmap">GitHub</Link>
        }
      />
    </HostFilesContext.Provider>
  );
}
