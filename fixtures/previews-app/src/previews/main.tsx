import { createRoot } from "react-dom/client";
import { setProjectAnnotations } from "@storybook/react";
import { PreviewRoute } from "product-doc/preview";
import preview from "../../.storybook/preview";

setProjectAnnotations([preview]);

const stories = import.meta.glob("../**/*.stories.tsx", { eager: true });

createRoot(document.getElementById("root")!).render(
  <PreviewRoute stories={stories} />,
);
