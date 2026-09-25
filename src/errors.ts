import * as errore from "errore";

export class DiffmapServeError extends errore.createTaggedError({
  name: "DiffmapServeError",
  message: "diffmap server failed: $reason",
}) {}

export class DiffmapFileError extends errore.createTaggedError({
  name: "DiffmapFileError",
  message: "diffmap could not read $path: $reason",
}) {}

export class DiffmapRegistryError extends errore.createTaggedError({
  name: "DiffmapRegistryError",
  message: "diffmap registry failed: $reason",
}) {}

export class DiffmapMermaidError extends errore.createTaggedError({
  name: "DiffmapMermaidError",
  message: "diffmap could not parse mermaid in $path ($where): $reason",
}) {}

export class DiffmapParseError extends errore.createTaggedError({
  name: "DiffmapParseError",
  message: "diffmap could not parse markdown",
}) {}

export class DiffmapAnnotationError extends errore.createTaggedError({
  name: "DiffmapAnnotationError",
  message: "diffmap source annotation: $reason",
}) {}

export class DiffmapDefinitionError extends errore.createTaggedError({
  name: "DiffmapDefinitionError",
  message: "$reason",
}) {}

export class DiffmapShareError extends errore.createTaggedError({
  name: "DiffmapShareError",
  message: "diffmap share failed: $reason",
}) {}

export class DiffmapUpdateError extends errore.createTaggedError({
  name: "DiffmapUpdateError",
  message: "diffmap update failed: $reason",
}) {}
