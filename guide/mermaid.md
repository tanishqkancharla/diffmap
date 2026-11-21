# Mermaid diagrams

A `mermaid` block draws a static diagram: a flowchart for which services exist and the paths between them, a sequence diagram for messages when state changes are not the point, or a state diagram for one service's lifecycle.

Use real names for nodes and arrows. Link a node to source with `%% ref node:<id> [[reference]]` and an edge with `%% ref edge:<index> [[reference]]` (counting from zero in declaration order). Add `diff` after `mermaid` to show a change, starting lines with `-` (before only), `+` (after only), or a space (both), and title the block with `[Title]`:

````md
```mermaid diff [Validate input]
 flowchart LR
-    A[requestHandler] -->|record| B[existingService]
+    A[requestHandler] -->|record| V[validateInput]
+    V -->|valid record| B[existingService]
+    V -->|invalid record| E[Return name error]
     B -->|record| D[Storage]
     %% ref node:A [[src/request.ts#requestHandler]]
     %% ref node:B [[src/service.ts#existingService]]
```
````
