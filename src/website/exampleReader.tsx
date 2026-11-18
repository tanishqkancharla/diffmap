import { createRoot } from "react-dom/client";
import { useLayoutEffect } from "react";
import { MauiProvider } from "maui";
import { init } from "md4x/standalone";
import { parseViewerDocument, type ViewerDocument } from "../parseViewer.ts";
import { HostFilesContext } from "../host/files.ts";
import {
  sessionStoreChanges,
  sessionStoreFiles,
  SESSION_STORE_REV,
} from "../host/sessionStorePr.ts";
import {
  ChangesLoaderContext,
  type ChangesLoader,
} from "../viewer/changesSource.ts";
import { ViewerApp } from "../viewer/ViewerApp.tsx";
import { examplePages } from "./examples.ts";
import "../viewer/styles.css";

const beforeFiles = Object.fromEntries(
  sessionStoreChanges.files.flatMap((file) =>
    file.contents?.old === undefined ? [] : [[file.path, file.contents.old]],
  ),
);
const loadBefore: ChangesLoader = async (rev) => ({
  rev,
  title: "Current sample source — no proposed changes",
  files: [],
});
const loadReview: ChangesLoader = async () => sessionStoreChanges;

function ExampleReader({
  document,
  review,
  onReady,
}: {
  document: ViewerDocument;
  review: boolean;
  onReady: () => void;
}) {
  useLayoutEffect(onReady, [onReady]);
  return (
    <MauiProvider>
      <HostFilesContext.Provider
        value={review ? sessionStoreFiles : beforeFiles}
      >
        <ChangesLoaderContext.Provider value={review ? loadReview : loadBefore}>
          <ViewerApp
            document={document}
            mode="host"
            defaultRev={review ? SESSION_STORE_REV : undefined}
          />
        </ChangesLoaderContext.Provider>
      </HostFilesContext.Provider>
    </MauiProvider>
  );
}

export async function mountExample(root: HTMLElement) {
  const page = examplePages.find((item) => item.path === root.dataset.example);
  if (!page) return;
  await init();
  const document = parseViewerDocument(page.body, `${page.path}.md`);
  if (document instanceof Error) throw document;
  const fallback = root.firstElementChild;
  const enhanced = window.document.createElement("div");
  enhanced.hidden = true;
  root.append(enhanced);
  createRoot(enhanced).render(
    <ExampleReader
      document={document}
      review={page.path === "/examples/review"}
      onReady={() => {
        fallback?.remove();
        enhanced.hidden = false;
        root.dataset.ready = "true";
      }}
    />,
  );
}
