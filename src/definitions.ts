import path from "node:path";
import fs from "node:fs";
import { pythonDefinition } from "./pythonDefinitions.js";
import ts from "typescript6";
import * as errore from "errore";
import { TkstackDefinitionError } from "./errors.js";

export type SourceDefinition = {
  path: string;
  contents: string;
  start: number;
  end: number;
};

export type DefinitionResponse = {
  definition?: SourceDefinition;
  error?: string;
};

export async function findDefinition(
  workspaceRoot: string,
  params: URLSearchParams,
) {
  const requestedPath = params.get("path");
  const line = Number(params.get("line"));
  const column = Number(params.get("column"));
  const lineText = params.get("text");
  if (
    requestedPath === null ||
    lineText === null ||
    !Number.isSafeInteger(line) ||
    line < 1 ||
    !Number.isSafeInteger(column) ||
    column < 0
  )
    return new TkstackDefinitionError({ reason: "Invalid source position." });

  const fileName = path.resolve(workspaceRoot, requestedPath);
  if (!fileName.startsWith(workspaceRoot + path.sep)) {
    return new TkstackDefinitionError({
      reason: "Path escapes the workspace.",
    });
  }
  if (!/\.(?:py|[cm]?[jt]sx?)$/i.test(fileName)) {
    return new TkstackDefinitionError({
      reason:
        "Definition navigation supports Python, TypeScript and JavaScript.",
    });
  }
  if (
    fs.existsSync(fileName) &&
    !fs
      .realpathSync(fileName)
      .startsWith(fs.realpathSync(workspaceRoot) + path.sep)
  )
    return new TkstackDefinitionError({
      reason: "Path escapes the workspace.",
    });
  const contents = ts.sys.readFile(fileName);
  if (contents === undefined) {
    return new TkstackDefinitionError({
      reason: "This file is no longer in the workspace.",
    });
  }
  const lines = contents.split(/\r?\n/);
  if (lines[line - 1] !== lineText || column >= lineText.length) {
    return new TkstackDefinitionError({
      reason:
        "This diff line differs from the current workspace. Its definition cannot be resolved.",
    });
  }
  if (fileName.endsWith(".py"))
    return pythonDefinition(workspaceRoot, fileName, contents, {
      line,
      column,
    });
  const service = createLanguageService(workspaceRoot, fileName);
  if (service instanceof Error) return service;
  using resources = new errore.DisposableStack();
  resources.defer(() => service.dispose());
  const source = service.getProgram()!.getSourceFile(fileName)!;
  const position = source.getPositionOfLineAndCharacter(line - 1, column);
  const definition = service.getDefinitionAtPosition(fileName, position)?.[0];
  if (definition === undefined) {
    return undefined;
  }
  const target = service.getProgram()!.getSourceFile(definition.fileName)!;
  const result: SourceDefinition = {
    path: path.relative(workspaceRoot, definition.fileName),
    contents: target.text,
    start:
      target.getLineAndCharacterOfPosition(definition.textSpan.start).line + 1,
    end:
      target.getLineAndCharacterOfPosition(
        definition.textSpan.start + definition.textSpan.length,
      ).line + 1,
  };
  return result;
}

function createLanguageService(workspaceRoot: string, fileName: string) {
  const configPath = ts.findConfigFile(
    path.dirname(fileName),
    ts.sys.fileExists,
  );
  let options: ts.CompilerOptions = {
    allowJs: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
  };
  if (configPath !== undefined) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error !== undefined) {
      return new TkstackDefinitionError({
        reason: ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
      });
    }
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      path.dirname(configPath),
    );
    options = { ...options, ...parsed.options, allowJs: true };
  }

  return ts.createLanguageService({
    ...ts.sys,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    getCompilationSettings: () => options,
    getScriptFileNames: () => [fileName],
    getScriptVersion: () => "0",
    getScriptSnapshot: (name) => {
      const source = ts.sys.readFile(name);
      return source === undefined
        ? undefined
        : ts.ScriptSnapshot.fromString(source);
    },
    getCurrentDirectory: () => workspaceRoot,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
  });
}

export async function readSourceReference(
  workspaceRoot: string,
  params: URLSearchParams,
) {
  const requestedPath = params.get("path");
  if (requestedPath === null || requestedPath.length === 0)
    return new TkstackDefinitionError({ reason: "Missing file path." });
  const fileName = path.resolve(workspaceRoot, requestedPath);
  if (!fileName.startsWith(workspaceRoot + path.sep))
    return new TkstackDefinitionError({
      reason: "Path escapes the workspace.",
    });
  if (
    fs.existsSync(fileName) &&
    !fs
      .realpathSync(fileName)
      .startsWith(fs.realpathSync(workspaceRoot) + path.sep)
  )
    return new TkstackDefinitionError({
      reason: "Path escapes the workspace.",
    });
  const contents = ts.sys.readFile(fileName);
  if (contents === undefined)
    return new TkstackDefinitionError({
      reason: `Could not read ${requestedPath}.`,
    });
  const symbol = params.get("symbol");
  if (symbol !== null) {
    if (fileName.endsWith(".py"))
      return pythonDefinition(workspaceRoot, fileName, contents, { symbol });
    if (!/\.[cm]?[jt]sx?$/i.test(fileName))
      return new TkstackDefinitionError({
        reason: "Symbol references support TypeScript and JavaScript.",
      });
    const service = createLanguageService(workspaceRoot, fileName);
    if (service instanceof Error) return service;
    using resources = new errore.DisposableStack();
    resources.defer(() => service.dispose());
    const matches: { name: string; node: ts.NavigationTree }[] = [];
    function visit(node: ts.NavigationTree, parents: string[]) {
      const names = [...parents, node.text];
      const name = names.join(".");
      if (name === symbol || name.endsWith(`.${symbol}`))
        matches.push({ name, node });
      for (const child of node.childItems === undefined ? [] : node.childItems)
        visit(child, names);
    }
    const tree = service.getNavigationTree(fileName);
    for (const child of tree.childItems === undefined ? [] : tree.childItems)
      visit(child, []);
    if (matches.length === 0)
      return new TkstackDefinitionError({
        reason: `Symbol "${symbol}" was not found in ${requestedPath}.`,
      });
    if (matches.length > 1)
      return new TkstackDefinitionError({
        reason: `Symbol "${symbol}" is ambiguous. Use a qualified name: ${matches.map((match) => match.name).join(", ")}.`,
      });
    const spans = matches[0]!.node.spans;
    const source = ts.createSourceFile(
      fileName,
      contents,
      ts.ScriptTarget.Latest,
    );
    const start = Math.min(...spans.map((span) => span.start));
    const end = Math.max(...spans.map((span) => span.start + span.length));
    return {
      path: path.relative(workspaceRoot, fileName),
      contents,
      start: source.getLineAndCharacterOfPosition(start).line + 1,
      end:
        source.getLineAndCharacterOfPosition(Math.max(start, end - 1)).line + 1,
    } satisfies SourceDefinition;
  }
  const lineCount = contents.split("\n").length;
  const start = params.has("start") ? Number(params.get("start")) : 1;
  const end = params.has("end") ? Number(params.get("end")) : lineCount;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 1 ||
    end < start ||
    end > lineCount
  )
    return new TkstackDefinitionError({
      reason: `Invalid line range for ${requestedPath}.`,
    });
  return {
    path: path.relative(workspaceRoot, fileName),
    contents,
    start,
    end,
  } satisfies SourceDefinition;
}
