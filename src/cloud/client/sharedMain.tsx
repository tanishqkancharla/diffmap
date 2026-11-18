import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider } from "maui";
import { SharedApp } from "./SharedApp.tsx";
import "../../viewer/styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("productdoc root element is missing");

createRoot(root).render(
  <StrictMode>
    <MauiProvider>
      <SharedApp />
    </MauiProvider>
  </StrictMode>,
);
