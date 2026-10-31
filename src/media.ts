export const GALLERY_LAYOUTS = ["side-by-side", "grid", "carousel"];

/** Recordings render as players; every other source is an image. */
export function isVideoSource(src: string) {
  return /\.(?:mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(src);
}

/** A path rather than a URL: the viewer loads it from beside the spec. */
export function isLocalMedia(src: string) {
  return !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src);
}
