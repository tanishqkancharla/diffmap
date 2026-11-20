import type { ReactNode } from "react";
import { LoadingScreen } from "maui";
import { useDemo } from "../../landing/shared.tsx";
import { ViewerApp } from "../ViewerApp.tsx";
import type { ViewerMode } from "../viewerMode.ts";

/** The landing page's sessions-in-Postgres document in the real viewer, for the sharing stories. */
export function DemoViewer(props: {
  mode?: ViewerMode;
  headerActions?: ReactNode;
}) {
  const demo = useDemo();
  if (demo === undefined) return <LoadingScreen />;
  if (demo instanceof Error) throw demo;
  return (
    <ViewerApp
      document={demo}
      mode={props.mode ?? "host"}
      headerActions={props.headerActions}
    />
  );
}

/** The document's first screen shrunk to fit the share dialog's browser frame. */
export function DemoThumbnail() {
  return (
    <div
      style={{
        width: "250%",
        height: 640,
        transform: "scale(0.4)",
        transformOrigin: "0 0",
        overflow: "hidden",
      }}
    >
      <DemoViewer />
    </div>
  );
}

/** The local viewer with the share dialog open over it. */
export function DialogStage(props: {
  headerActions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
      <DemoViewer headerActions={props.headerActions} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 48,
          overflowY: "auto",
          background: "rgb(0 0 0 / 0.32)",
        }}
      >
        {props.children}
      </div>
    </div>
  );
}
