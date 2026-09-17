import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider, P } from "maui";
import { parseError, viewerDocument } from "virtual:diffmap";
import { ViewerApp } from "./ViewerApp.tsx";
import { GistStatus } from "../gist/GistStatus.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("diffmap root element is missing");

createRoot(root).render(
  <StrictMode>
    <MauiProvider>
      {parseError !== null || viewerDocument === null ? (
        <GistStatus title="Could not parse this spec">
          <P>{parseError ?? "Unknown parse error."}</P>
        </GistStatus>
      ) : (
        <ViewerApp document={viewerDocument} mode="local" />
      )}
    </MauiProvider>
  </StrictMode>,
);
