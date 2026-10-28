import type { Fence as FenceModel } from "../parseFence.js";
import type { SourceNavigation } from "../annotations.js";
import { CallStackDiff } from "./CallStackDiff.tsx";
import { ChangesCard } from "./ChangesCard.tsx";
import { CodeBlock } from "./CodeBlock.tsx";
import { CodeDiff } from "./CodeDiff.tsx";
import { FileExcerpt } from "./FileExcerpt.tsx";
import { HtmlBlock } from "./HtmlBlock.tsx";
import { HtmlPlaceholder } from "./HtmlPlaceholder.tsx";
import { MermaidBlock } from "./MermaidBlock.tsx";
import { ServiceDiagramBlock } from "./ServiceDiagramBlock.tsx";
import { useViewerMode } from "./viewerMode.ts";

export function Fence(props: { fence: FenceModel } & SourceNavigation) {
  const fence = props.fence;
  const trustedHtml = useViewerMode() === "local";
  if (fence.kind === "mermaid")
    return (
      <MermaidBlock
        source={fence.source}
        annotations={fence.annotations}
        selectedAnnotation={props.selectedAnnotation}
        onSelectAnnotation={props.onSelectAnnotation}
      />
    );
  if (fence.kind === "services")
    return (
      <ServiceDiagramBlock
        source={fence.source}
        parsed={fence.parsed}
        selectedAnnotation={props.selectedAnnotation}
        onSelectAnnotation={props.onSelectAnnotation}
      />
    );
  if (fence.kind === "html") {
    if (!trustedHtml) return <HtmlPlaceholder />;
    return <HtmlBlock source={fence.source} />;
  }
  if (fence.kind === "changes")
    return (
      <ChangesCard
        rev={fence.rev}
        review={fence.review}
        selectedAnnotation={props.selectedAnnotation}
        onSelectAnnotation={props.onSelectAnnotation}
      />
    );
  if (fence.kind === "callstack")
    return (
      <CallStackDiff
        lines={fence.lines}
        highlights={fence.highlights}
        notes={fence.notes}
        title={fence.title}
        selectedAnnotation={props.selectedAnnotation}
        onSelectAnnotation={props.onSelectAnnotation}
      />
    );
  if (fence.kind === "diff") {
    return <CodeDiff source={fence.source} path={fence.path} />;
  }
  if (fence.kind === "file") {
    return (
      <FileExcerpt
        path={fence.path}
        start={fence.start}
        end={fence.end}
        fallback={fence.source}
      />
    );
  }
  return (
    <CodeBlock
      lang={fence.lang}
      source={fence.source}
      highlights={fence.highlights}
      notes={fence.notes}
      title={fence.title}
    />
  );
}
