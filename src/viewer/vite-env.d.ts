declare module "virtual:diffmap" {
  import type { ViewerDocument } from "../parseViewer.js";
  export const viewerDocument: ViewerDocument | null;
  export const parseError: string | null;
}
