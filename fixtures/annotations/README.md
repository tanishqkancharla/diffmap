# Source annotations

Click a linked stack line to inspect its source changes. Use Tab and Enter to navigate with the keyboard.

## Show the open path in the source header

Commit c66b4a9 replaced the panel's "Source file" label with the open path and a one-line pin. It touched several files:

```changes
c66b4a9
```

`SourceDiffPanel` now asks three helpers in a new file what to show above the code:

```callstack
 SourceDiffPanel  # render the Diff panel [[c66b4a9:src/viewer/SourceDiffPanel.tsx#L51-L55]]
-├── "Source file" label  # same title for every file
+├── sourcePanelPath  # pick the open file path [[c66b4a9:src/viewer/SourceDiffPanel.tsx#L126-L131]] [[c66b4a9:src/viewer/sourceHeader.ts#L23-L40]]
+├── sourcePanelOrigin  # tell a file from a diff [[c66b4a9:src/viewer/SourceDiffPanel.tsx#L132-L137]] [[c66b4a9:src/viewer/sourceHeader.ts#L42-L64]]
+├── sourcePanelPin  # link the path to GitHub or a gist [[c66b4a9:src/viewer/SourceDiffPanel.tsx#L138-L146]] [[c66b4a9:src/viewer/sourceHeader.ts#L70-L103]]
 └── pierreDiffOptions  # hide Pierre's header when the path shows [[c66b4a9:src/viewer/SourceDiffPanel.tsx#L147-L150]]
```

The first row links unchanged context in the same commit. The helper rows link two files; select either change above the source viewer to move between them. The removed label has no link because deleted lines cannot be referenced.

The header renders the path where the label used to be:

```callstack
 SourceDiffPanel
+└── title row  # show the open path [[c66b4a9:src/viewer/SourceDiffPanel.tsx#L217-L222]]
```

## Plain stacks still work

```callstack
 application
 └── render
```
