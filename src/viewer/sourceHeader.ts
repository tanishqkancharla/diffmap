import type { CodeViewDiffItem } from "@pierre/diffs";
import type { SourceReference } from "../annotations.js";
import type { GistPin } from "../gist/pin.ts";
import { githubGistUrl } from "../gist/route.ts";
import type { GitHubPin } from "../github/pin.ts";
import { githubBlobUrl } from "../github/route.ts";

const PR_DIFF_PREFIX = "pr:";

export type SourcePanelOrigin = "file" | "spec-diff" | "repo-diff";

export type SourcePanelPin =
  | { kind: "github"; label: string; href: string }
  | { kind: "gist"; label: string; href: string }
  | { kind: "spec"; label: "from this spec" }
  | { kind: "none" };

/** Pull-files diffs are repo patches at the pin SHA; everything else is embedded in the spec. */
export function isSpecEmbeddedDiff(item: CodeViewDiffItem) {
  return !item.id.startsWith(PR_DIFF_PREFIX);
}

export function sourcePanelPath(input: {
  filePath?: string;
  reference?: SourceReference;
  items: CodeViewDiffItem[];
  linkedDiffId?: string;
}): string | undefined {
  if (input.filePath !== undefined && input.filePath.length > 0) {
    return input.filePath;
  }
  if (input.linkedDiffId !== undefined) {
    const linked = input.items.find((item) => item.id === input.linkedDiffId);
    if (linked !== undefined) return linked.fileDiff.name;
  }
  const ref = input.reference;
  if (ref === undefined) return undefined;
  if (ref.kind === "file") return ref.path;
  return input.items.find((item) => item.id === ref.id)?.fileDiff.name;
}

export function sourcePanelOrigin(input: {
  showingFile: boolean;
  reference?: SourceReference;
  items: CodeViewDiffItem[];
  linkedDiffId?: string;
}): SourcePanelOrigin {
  if (input.showingFile) return "file";
  const ref = input.reference;
  const focused =
    input.linkedDiffId !== undefined
      ? input.items.find((item) => item.id === input.linkedDiffId)
      : ref?.kind === "diff"
        ? input.items.find((item) => item.id === ref.id)
        : ref?.kind === "file"
          ? input.items.find((item) => item.fileDiff.name === ref.path)
          : undefined;
  if (focused !== undefined) {
    return isSpecEmbeddedDiff(focused) ? "spec-diff" : "repo-diff";
  }
  if (input.items.some(isSpecEmbeddedDiff)) return "spec-diff";
  if (input.items.length > 0) return "repo-diff";
  return "file";
}

/**
 * Pin line for the source panel. A hosted spec is one SHA; blob links use that
 * SHA for the open path. Embedded `source-diff` is from the spec, not a blob.
 */
export function sourcePanelPin(input: {
  origin: SourcePanelOrigin;
  path: string | undefined;
  github?: GitHubPin;
  gist?: GistPin;
}): SourcePanelPin {
  if (input.origin === "spec-diff") {
    return { kind: "spec", label: "from this spec" };
  }
  if (input.github !== undefined && input.path !== undefined) {
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
