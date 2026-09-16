import { useEffect, useState } from "react";
import { GistApp } from "../gist/GistApp.tsx";
import { GitHubApp } from "../github/GitHubApp.tsx";
import { parseGitHubPath } from "../github/route.ts";

function isGitHubPath(pathname: string) {
  return parseGitHubPath(pathname).kind !== "home";
}

export function HostApp() {
  const [github, setGithub] = useState(() =>
    isGitHubPath(window.location.pathname),
  );

  useEffect(() => {
    const onPop = () => setGithub(isGitHubPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return github ? <GitHubApp /> : <GistApp />;
}
