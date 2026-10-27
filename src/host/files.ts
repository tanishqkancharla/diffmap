import { createContext, useContext } from "react";

/**
 * Files a hosted viewer has without a server: the homepage's bundled sources,
 * or the files `diffmap share` saved in a gist. `[[path]]` and file excerpts
 * read these, not GitHub.
 */
export type HostFiles = Record<string, string>;

export const HostFilesContext = createContext<HostFiles | undefined>(undefined);

export function useHostFiles() {
  return useContext(HostFilesContext);
}
