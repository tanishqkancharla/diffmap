import { createContext, useContext } from "react";

export type ViewerMode = "local" | "gist";

export const ViewerModeContext = createContext<ViewerMode>("local");

export function useViewerMode() {
  return useContext(ViewerModeContext);
}
