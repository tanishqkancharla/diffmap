import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { Cli, z } from "incur";
import { DiffmapFileError } from "./errors.js";
import { resolveFromInvokeCwd } from "./invokeCwd.js";
import { packageVersion } from "./packageVersion.js";
import { listRunningDiffmaps } from "./registry.js";
import { exitAfterTelemetry, trackCommand } from "./telemetry.js";
import {
  detectInstallMethod,
  fetchLatestVersion,
  packageName,
  resolveUpdateArgv,
  runCommand,
  runUpdate,
} from "./update.js";

const serveArgs = z.object({
  file: z.string().describe("Path to the markdown file"),
});

const serveOptions = z.object({
  port: z.coerce.number().optional().describe("Port (default: a free port)"),
  root: z.string().optional().describe("Workspace root for file excerpts"),
});

const serveOutput = z.object({
  url: z.string(),
  file: z.string(),
  warnings: z.array(z.string()).optional(),
});

type ServeContext = {
  args: { file: string };
  options: { port?: number | undefined; root?: string | undefined };
  error: (input: { code: string; message: string }) => never;
};

async function* runServe(c: ServeContext) {
  trackCommand("serve");
  // Loaded per command so `--version`, `list`, and `update` skip the server's dependencies.
  const { startServer } = await import("./serve.js");
  const started = await startServer({
    filePath: resolveFromInvokeCwd(c.args.file),
    workspaceRoot:
      c.options.root === undefined
        ? resolveFromInvokeCwd(".")
        : resolveFromInvokeCwd(c.options.root),
    port: c.options.port,
  });
  if (started instanceof Error) {
    return c.error({
      code: "DIFFMAP",
      message: started.message,
    });
  }
  const output = {
    url: started.url,
    file: started.filePath,
    ...(started.warnings.length > 0 ? { warnings: started.warnings } : {}),
  };
  yield output;
  await started.closed;
  return output;
}

const cli = Cli.create("diffmap", {
  description: "Serve a spec locally, or share it as a gist",
  version: packageVersion,
  args: serveArgs,
  options: serveOptions,
  output: serveOutput,
  hint: "`guide` prints how to write a spec. `validate <spec.md>` checks it without starting a server. `serve <spec.md>` runs the local viewer. `share <spec.md>` publishes an unlisted gist. `update` (or `--update`) installs the latest diffmap.",
  examples: [
    {
      args: { file: "spec.md" },
      description: "Same as `diffmap serve spec.md`",
    },
  ],
  run: runServe,
})
  .command("serve", {
    description: "Run the local viewer server",
    args: serveArgs,
    options: serveOptions,
    output: serveOutput,
    examples: [
      {
        args: { file: "spec.md" },
        description: "Open the local viewer",
      },
    ],
    run: runServe,
  })
  .command("validate", {
    description:
      "Check a spec's syntax, diagrams, and annotations without starting a server",
    args: serveArgs,
    output: z.object({ file: z.string(), valid: z.literal(true) }),
    async run(c) {
      trackCommand("validate");
      const { parseViewerDocument } = await import("./parseViewer.js");
      const file = resolveFromInvokeCwd(c.args.file);
      const source = await readFile(file, "utf8").catch(
        (cause) => new DiffmapFileError({ path: file, reason: "read", cause }),
      );
      const result =
        source instanceof Error ? source : parseViewerDocument(source, file);
      if (result instanceof Error)
        return c.error({ code: "DIFFMAP", message: result.message });
      return c.ok({ file, valid: true });
    },
  })
  .command("share", {
    description:
      "Publish an unlisted gist and print https://diffmap.dev/g/<id>",
    args: z.object({
      file: z.string().describe("Path to the markdown file"),
    }),
    options: z.object({
      public: z.boolean().optional().describe("Create a public gist"),
    }),
    output: z.object({
      gistId: z.string(),
      gistUrl: z.string(),
      viewerUrl: z.string(),
    }),
    examples: [
      {
        args: { file: "spec.md" },
        description: "Unlisted gist → https://diffmap.dev/g/<id>",
      },
    ],
    async run(c) {
      trackCommand("share");
      const { shareMarkdownFile } = await import("./share.js");
      const shared = await shareMarkdownFile({
        filePath: resolveFromInvokeCwd(c.args.file),
        workspaceRoot: resolveFromInvokeCwd("."),
        isPublic: c.options.public === true,
      });
      if (shared instanceof Error) {
        return c.error({
          code: "DIFFMAP",
          message: shared.message,
        });
      }
      return c.ok(shared);
    },
  })
  .command("guide", {
    description: "Print the instructions agents follow to write a spec",
    output: z.string(),
    run() {
      trackCommand("guide");
      return readFileSync(new URL("../guide.md", import.meta.url), "utf8");
    },
  })
  .command("list", {
    description: "List running diffmap viewers",
    output: z.object({
      instances: z.array(
        z.object({
          pid: z.number(),
          title: z.string(),
          url: z.string(),
          file: z.string(),
        }),
      ),
    }),
    async run(c) {
      trackCommand("list");
      const instances = await listRunningDiffmaps();
      if (instances instanceof Error) {
        return c.error({
          code: "DIFFMAP",
          message: instances.message,
        });
      }
      return c.ok({ instances });
    },
  })
  .command("update", {
    description: `Update diffmap to the latest ${packageName} on npm (same as --update)`,
    output: z.object({
      status: z.enum(["up-to-date", "updated", "manual"]),
      message: z.string(),
      current: z.string(),
      previous: z.string().optional(),
      latest: z.string().optional(),
      command: z.string().optional(),
    }),
    async run(c) {
      trackCommand("update");
      const result = await runUpdate({
        currentVersion: packageVersion,
        fetchLatestVersion,
        detectInstallMethod,
        runCommand,
      });
      if (result instanceof Error) {
        return c.error({
          code: "UPDATE_FAILED",
          message: result.message,
        });
      }
      return c.ok(result);
    },
  });

await cli.serve(resolveUpdateArgv(process.argv.slice(2)), {
  exit: exitAfterTelemetry,
});
