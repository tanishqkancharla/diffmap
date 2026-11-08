import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider } from "maui";
import { Landing } from "./Landing.tsx";
import "../viewer/styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("diffmap root element is missing");

createRoot(root).render(
  <StrictMode>
    <MauiProvider>
      <Landing />
    </MauiProvider>
  </StrictMode>,
);
