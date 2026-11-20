import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setProjectAnnotations, type Decorator } from "@storybook/react";
import { MauiProvider } from "maui";
import { PreviewRoute } from "../preview/index.ts";
import "./styles.css";

// The viewer's own preview page, for preview and flow blocks in documents about the viewer's UI.
const withMaui: Decorator = (Story) => (
  <MauiProvider>
    <div style={{ padding: 16, display: "inline-block" }}>
      <Story />
    </div>
  </MauiProvider>
);
setProjectAnnotations([{ decorators: [withMaui] }]);

const stories = import.meta.glob("./**/*.stories.tsx", { eager: true });

const root = document.getElementById("root");
if (root === null)
  throw new Error("the preview page's root element is missing");
createRoot(root).render(
  <StrictMode>
    <PreviewRoute stories={stories} />
  </StrictMode>,
);
