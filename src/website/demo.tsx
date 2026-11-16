import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { useLayoutEffect } from "react";
import { MauiProvider, P, flex } from "maui";
import { useStyles } from "purse-styles";
import { fetchGitHubChanges } from "../github/fetchRepo.ts";
import { HostFilesContext } from "../host/files.ts";
import {
  SESSION_STORE_REV,
  sessionStoreChanges,
  sessionStoreFiles,
} from "../host/sessionStorePr.ts";
import { promptCode } from "../landing/Mesh.tsx";
import { ScrollDemo } from "../landing/ScrollDemo.tsx";
import { useDemo } from "../landing/shared.tsx";
import {
  ChangesLoaderContext,
  type ChangesLoader,
} from "../viewer/changesSource.ts";
import { CommentsContext, useCommentStore } from "../viewer/comments.ts";
import { ViewerModeContext } from "../viewer/viewerMode.ts";
import { CodeBlock } from "../viewer/CodeBlock.tsx";
import { examplePrompt } from "./content.ts";
import "../viewer/styles.css";

const loadChanges: ChangesLoader = (rev) =>
  rev === SESSION_STORE_REV
    ? Promise.resolve(sessionStoreChanges)
    : fetchGitHubChanges({ owner: "tanishqkancharla", repo: "diffmap" }, rev);

function Prompt({ onReady }: { onReady: () => void }) {
  const className = useStyles(
    promptCode,
    flex({ direction: "column", alignItems: "center" }),
  );
  useLayoutEffect(onReady, [onReady]);
  return (
    <div className={className}>
      <CodeBlock
        lang="text"
        source={examplePrompt}
        highlights={[]}
        notes={[]}
        title={undefined}
      />
    </div>
  );
}

function Demo({ onReady }: { onReady: () => void }) {
  const document = useDemo();
  const comments = useCommentStore("productdoc-comments:landing");
  useLayoutEffect(() => {
    if (document !== undefined) onReady();
  }, [document, onReady]);
  if (document === undefined) return;
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

// The artwork is already in the initial HTML; enhance only the reader/prompt.
export function mountDemo(root: HTMLElement) {
  const prompt = document.getElementById("prompt-snippet");
  const promptFallback = prompt?.firstElementChild;
  const showPrompt = () => promptFallback?.remove();
  const fallback = root.firstElementChild;
  const enhanced = document.createElement("div");
  enhanced.hidden = true;
  root.append(enhanced);
  const showDemo = () => {
    fallback?.remove();
    enhanced.hidden = false;
  };
  createRoot(enhanced).render(
    <MauiProvider>
      {prompt && createPortal(<Prompt onReady={showPrompt} />, prompt)}
      <Demo onReady={showDemo} />
    </MauiProvider>,
  );
}
