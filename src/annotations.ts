type DiffReference = {
  kind: "diff";
  id: string;
  side: "old" | "new";
  start: number;
  end: number;
};

type FileReference = {
  kind: "file";
  path: string;
  symbol?: string;
  start?: number;
  end?: number;
};

export type SourceReference = DiffReference | FileReference;

export type SourceAnnotation = {
  text: string;
  references: SourceReference[];
  explanationId?: string;
};

export function parseCallStack(source: string): SourceAnnotation[] {
  return source.split("\n").map(parseAnnotation);
}

export function parseAnnotation(line: string): SourceAnnotation {
  const references: SourceReference[] = [];
  let explanationId: string | undefined;
  const text = line.replace(
    /\s*\[\[([^[\]\n]+)\]\]/g,
    (match, value: string) => {
      if (/^explain:[\w-]+$/.test(value)) {
        if (explanationId !== undefined) return match;
        explanationId = value.slice(8);
        return "";
      }
      const reference = parseReference(value);
      if (reference === undefined) return match;
      references.push(reference);
      return "";
    },
  );
  return { text, references, explanationId };
}

function parseReference(value: string): SourceReference | undefined {
  const diff = /^([\w-]+):(old|new):([1-9]\d*)(?:-([1-9]\d*))?$/.exec(value);
  if (diff !== null)
    return {
      kind: "diff",
      id: diff[1]!,
      side: diff[2] === "old" ? "old" : "new",
      start: Number(diff[3]),
      end: Number(diff[4] === undefined ? diff[3] : diff[4]),
    };
  const file = /^([^#:[\]\n]+)(?:#(.+))?$/.exec(value);
  if (file === null || file[1]!.trim().length === 0) return undefined;
  const path = file[1]!.trim();
  const fragment = file[2];
  if (fragment === undefined) return { kind: "file", path };
  const range = /^L([1-9]\d*)(?:-L?([1-9]\d*))?$/.exec(fragment);
  if (range !== null)
    return {
      kind: "file",
      path,
      start: Number(range[1]),
      end: Number(range[2] === undefined ? range[1] : range[2]),
    };
  if (!/^[\w$]+(?:\.[\w$]+)*$/.test(fragment)) return undefined;
  return { kind: "file", path, symbol: fragment };
}

export function referenceLabel(reference: SourceReference) {
  if (reference.kind === "diff")
    return `${reference.id} · ${reference.side} ${reference.start}–${reference.end}`;
  if (reference.symbol !== undefined)
    return `${reference.path}#${reference.symbol}`;
  if (reference.start !== undefined)
    return `${reference.path}#L${reference.start}-L${reference.end}`;
  return reference.path;
}

export type SourceNavigation = {
  selectedAnnotation: SourceAnnotation | undefined;
  onSelectAnnotation: (annotation: SourceAnnotation) => void;
};
