import { createContext, useContext } from "react";

/** Bundled files for the hosted homepage. `[[path]]` reads these, not GitHub. */
export type HostFiles = Record<string, string>;

export const HostFilesContext = createContext<HostFiles | undefined>(undefined);

export function useHostFiles() {
  return useContext(HostFilesContext);
}
