import * as errore from "errore";

export class DiffmapServeError extends errore.createTaggedError({
  name: "DiffmapServeError",
  message: "product-doc server failed: $reason",
}) {}

export class DiffmapFileError extends errore.createTaggedError({
  name: "DiffmapFileError",
  message: "product-doc could not read $path: $reason",
}) {}

export class DiffmapRegistryError extends errore.createTaggedError({
  name: "DiffmapRegistryError",
  message: "product-doc registry failed: $reason",
}) {}

export class DiffmapSpecError extends errore.createTaggedError({
  name: "DiffmapSpecError",
  message: "product-doc spec $path: $reason",
}) {}

export class DiffmapMermaidError extends errore.createTaggedError({
  name: "DiffmapMermaidError",
  message: "product-doc could not parse mermaid in $path ($where): $reason",
}) {}

export class DiffmapServicesError extends errore.createTaggedError({
  name: "DiffmapServicesError",
  message: "product-doc could not parse services in $path ($where): $reason",
}) {}

export class DiffmapGalleryError extends errore.createTaggedError({
  name: "DiffmapGalleryError",
  message: "product-doc could not parse a gallery in $path: $reason",
}) {}

export class DiffmapParseError extends errore.createTaggedError({
  name: "DiffmapParseError",
  message: "product-doc could not parse markdown",
}) {}

export class DiffmapAnnotationError extends errore.createTaggedError({
  name: "DiffmapAnnotationError",
  message: "product-doc source annotation: $reason",
}) {}

export class DiffmapGitError extends errore.createTaggedError({
  name: "DiffmapGitError",
  message: "$reason",
}) {}

export class DiffmapDefinitionError extends errore.createTaggedError({
  name: "DiffmapDefinitionError",
  message: "$reason",
}) {}

export class DiffmapShareError extends errore.createTaggedError({
  name: "DiffmapShareError",
  message: "product-doc share failed: $reason",
}) {}

export class ProductdocAuthError extends errore.createTaggedError({
  name: "ProductdocAuthError",
  message: "product-doc sign-in failed: $reason",
}) {}

export class ProductdocRequestError extends errore.createTaggedError({
  name: "ProductdocRequestError",
  message: "$reason",
}) {
  /** The HTTP status productdoc.dev answered, or 0 when it couldn't be reached. */
  status = 0;
}

export class DiffmapUpdateError extends errore.createTaggedError({
  name: "DiffmapUpdateError",
  message: "product-doc update failed: $reason",
}) {}

export class DiffmapTelemetryError extends errore.createTaggedError({
  name: "DiffmapTelemetryError",
  message: "product-doc telemetry failed: $reason",
}) {}
