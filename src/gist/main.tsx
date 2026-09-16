import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider } from "maui";
import { rewritePiGistUrl } from "./route.ts";
import { HostApp } from "../host/HostApp.tsx";
import "../viewer/styles.css";

const rewritten = rewritePiGistUrl(
  window.location.pathname,
  window.location.hash,
);
if (rewritten !== undefined) {
  window.history.replaceState({}, "", rewritten);
}

const root = document.getElementById("root");
if (root === null) throw new Error("diffmap root element is missing");

createRoot(root).render(
  <StrictMode>
    <MauiProvider>
      <HostApp />
    </MauiProvider>
  </StrictMode>,
);
