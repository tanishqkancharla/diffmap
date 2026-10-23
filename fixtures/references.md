# Symbol and diagram references

Run from the repository root. The first references read the current diffmap source. The last diagram reads a commit.

```callstack
 parseViewerDocument [[src/parseViewer.ts#parseViewerDocument]]
 └── parseFence [[src/parseFence.ts#parseFence]]
     ├── parseCallStack [[src/annotations.ts#parseCallStack]]
     └── parseDiagramAnnotations [[src/diagramAnnotations.ts#parseDiagramAnnotations]]
```

## The shared source panel

Click a node, connecting line, or line label. Tab and Enter or Space also work.

```mermaid
flowchart LR
  Stack[Call stack] -->|Select row| Panel[Source panel]
  Diagram[Mermaid] -->|Select node or edge| Panel
  %% ref node:Stack [[src/viewer/CallStackDiff.tsx#CallStackDiff]]
  %% ref node:Diagram [[src/viewer/MermaidBlock.tsx#MermaidBlock]]
  %% ref node:Panel [[src/viewer/SourceDiffPanel.tsx#SourceDiffPanel]]
  %% ref edge:0 [[src/annotations.ts#SourceAnnotation]]
  %% ref edge:1 [[src/viewer/diagramLinks.ts#linkDiagram]] [[src/diagramAnnotations.ts]]
```

```mermaid
sequenceDiagram
  participant Panel
  participant Server
  Panel->>Server: Resolve file and symbol
  Server-->>Panel: Source and declaration range
  %% ref node:Panel [[src/viewer/SourceDiffPanel.tsx#SourceDiffPanel]]
  %% ref node:Server [[src/definitions.ts]]
  %% ref edge:0 [[src/viewer/sourceNavigation.ts#requestSource]]
  %% ref edge:1 [[src/definitions.ts#readSourceReference]]
```

## Commit references

Commit dae6b98 replaced the Done button with a quiet Close server button. Each node and edge opens the Diff panel on that commit, scrolled to the linked lines.

```mermaid
flowchart LR
  Header[ViewerApp header] -->|Local mode only| Close[CloseServerButton]
  Close -->|POST /__diffmap/shutdown| Closed[Closed spec page]
  %% ref node:Header [[dae6b98:src/viewer/ViewerApp.tsx#L211-L228]]
  %% ref node:Close [[dae6b98:src/viewer/CloseServerButton.tsx#L8-L16]]
  %% ref node:Closed [[dae6b98:src/viewer/ViewerApp.tsx#L176-L183]]
  %% ref edge:0 [[dae6b98:src/viewer/ViewerApp.tsx#L219-L227]]
  %% ref edge:1 [[dae6b98:src/viewer/ViewerApp.tsx#L316-L318]]
```

The deleted `DoneButton.tsx` has no node link. Deleted lines cannot be referenced.
