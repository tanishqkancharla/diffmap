import { createContext, useContext } from "react";

/** Pinned commit: every blob fetch for this page uses this SHA, never main. */
export type GitHubPin = {
  owner: string;
  repo: string;
  sha: string;
};

export const GitHubPinContext = createContext<GitHubPin | undefined>(undefined);

export function useGitHubPin() {
  return useContext(GitHubPinContext);
}
