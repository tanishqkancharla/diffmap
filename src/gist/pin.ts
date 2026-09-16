import { createContext, useContext } from "react";

/** Gist snapshot: identify the gist file, never a fake owner/repo. */
export type GistPin = {
  gistId: string;
  file: string;
  htmlUrl: string;
};

export const GistPinContext = createContext<GistPin | undefined>(undefined);

export function useGistPin() {
  return useContext(GistPinContext);
}
