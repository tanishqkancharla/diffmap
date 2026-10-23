import type { GistPin } from "../gist/pin.ts";
import { githubGistUrl } from "../gist/route.ts";
import type { GitHubPin } from "../github/pin.ts";
import { githubBlobUrl } from "../github/route.ts";

export type SourcePanelPin =
  | { kind: "github"; label: string; href: string }
  | { kind: "gist"; label: string; href: string }
  | { kind: "none" };

/**
 * Pin line under a single open file. A hosted spec is one SHA; blob links use
 * that SHA for the open path.
 */
export function sourcePanelPin(input: {
  path: string;
  github?: GitHubPin;
  gist?: GistPin;
}): SourcePanelPin {
  if (input.github !== undefined) {
    const shortSha = input.github.sha.slice(0, 7);
    return {
      kind: "github",
      label: `${input.github.owner}/${input.github.repo} @ ${shortSha}`,
      href: githubBlobUrl(
        input.github.owner,
        input.github.repo,
        input.github.sha,
        input.path,
      ),
    };
  }
  if (input.gist !== undefined) {
    return {
      kind: "gist",
      label: `${input.gist.gistId} / ${input.gist.file}`,
      href:
        input.gist.htmlUrl.length > 0
          ? input.gist.htmlUrl
          : githubGistUrl(input.gist.gistId),
    };
  }
  return { kind: "none" };
}
