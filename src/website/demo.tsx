import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { MauiProvider, P } from "maui";
import { fetchGitHubChanges } from "../github/fetchRepo.ts";
import { HostFilesContext } from "../host/files.ts";
import {
  SESSION_STORE_REV,
  sessionStoreChanges,
  sessionStoreFiles,
} from "../host/sessionStorePr.ts";
import { Mesh, headerBlobs, footerBlobs } from "../landing/Mesh.tsx";
import { ScrollDemo } from "../landing/ScrollDemo.tsx";
import { useDemo } from "../landing/shared.tsx";
import {
  ChangesLoaderContext,
  type ChangesLoader,
} from "../viewer/changesSource.ts";
import { CommentsContext, useCommentStore } from "../viewer/comments.ts";
import { ViewerModeContext } from "../viewer/viewerMode.ts";
import "../viewer/styles.css";

const loadChanges: ChangesLoader = (rev) =>
  rev === SESSION_STORE_REV
    ? Promise.resolve(sessionStoreChanges)
    : fetchGitHubChanges({ owner: "tanishqkancharla", repo: "diffmap" }, rev);

function Demo() {
  const document = useDemo();
  const comments = useCommentStore("productdoc-comments:landing");
  if (document instanceof Error)
    return (
      <P>
        The interactive demo could not load.{" "}
        <a href="/examples/explain">Read the example instead.</a>
      </P>
    );
  return (
    <ViewerModeContext.Provider value="host">
      <CommentsContext.Provider value={comments}>
        <HostFilesContext.Provider value={sessionStoreFiles}>
          <ChangesLoaderContext.Provider value={loadChanges}>
            <ScrollDemo document={document} />
          </ChangesLoaderContext.Provider>
        </HostFilesContext.Provider>
      </CommentsContext.Provider>
    </ViewerModeContext.Provider>
  );
}

// Reuse the actual homepage reader, mesh formation, and grain—not a screenshot.
export function mountDemo(root: HTMLElement) {
  const hero = document.getElementById("hero-mesh");
  const footer = document.getElementById("footer-mesh");
  createRoot(root).render(
    <MauiProvider>
      {hero &&
        createPortal(
          <Mesh
            blobs={headerBlobs}
            edge="top"
            mask="linear-gradient(to bottom, black, black 35%, transparent)"
          />,
          hero,
        )}
      <Demo />
      {footer &&
        createPortal(
          <Mesh
            blobs={footerBlobs}
            edge="bottom"
            mask="linear-gradient(to top, black, black 12%, transparent 90%)"
            lamp
          />,
          footer,
        )}
    </MauiProvider>,
  );
}
