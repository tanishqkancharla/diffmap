/** Prefer HTML on ties. A specific q=0 overrides a wildcard acceptance. */
export function negotiate(accept = "") {
  const ranges = accept
    .toLowerCase()
    .split(",")
    .map((part) => {
      const [type = "", ...parameters] = part.trim().split(";");
      const quality = parameters
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const q = quality === undefined ? 1 : Number(quality.slice(2));
      return { type, q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
    });
  const quality = (type: string) => {
    for (const range of [type, "text/*", "*/*"]) {
      const matches = ranges.filter((r) => r.type === range);
      if (matches.length) return Math.max(...matches.map((r) => r.q));
    }
    return 0;
  };
  if (accept === "") return "html";
  const html = quality("text/html");
  const markdown = quality("text/markdown");
  if (html === 0 && markdown === 0) return "unacceptable";
  return markdown > html ? "md" : "html";
}
