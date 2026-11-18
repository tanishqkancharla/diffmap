import { readFileSync } from "node:fs";
import { Cli, z } from "incur";
import { resolveFromInvokeCwd } from "./invokeCwd.js";
import { packageVersion } from "./packageVersion.js";
import { listRunningDiffmaps } from "./registry.js";
import { exitAfterTelemetry, track, trackCommand } from "./telemetry.js";
import {
  detectInstallMethod,
  fetchLatestVersion,
  packageName,
  resolveUpdateArgv,
  runCommand,
  runUpdate,
} from "./update.js";

/** Progress for a person or agent watching, kept out of the command's output. */
function progress(line: string) {
  process.stderr.write(`${line}\n`);
}

const guideTopics = [
  "services",
  "callstack",
  "mermaid",
  "code",
  "previews",
  "ui",
] as const;

const serveArgs = z.object({
  file: z
    .string()
    .describe("The spec's directory, such as .diffmap/specs/<name>/"),
});

const serveOptions = z.object({
  port: z.coerce.number().optional().describe("Port (default: a free port)"),
  root: z.string().optional().describe("Workspace root for file excerpts"),
});

const serveOutput = z.union([
  z
    .string()
    .describe("What serve prints unless --format or --json asks for data"),
  z.object({
    url: z.string(),
    file: z.string(),
    warnings: z.array(z.string()).optional(),
  }),
]);

type ServeContext = {
  args: { file: string };
  options: { port?: number | undefined; root?: string | undefined };
  formatExplicit: boolean;
  error: (input: { code: string; message: string }) => never;
};

async function* runServe(c: ServeContext) {
  trackCommand("serve");
  // Loaded per command so `--version`, `list`, and `update` skip the server's dependencies.
  const { startServer } = await import("./serve.js");
  let readyAt = Date.now();
  let opened = false;
  const started = await startServer({
    filePath: resolveFromInvokeCwd(c.args.file),
    workspaceRoot:
      c.options.root === undefined
        ? resolveFromInvokeCwd(".")
        : resolveFromInvokeCwd(c.options.root),
    port: c.options.port,
    onViewerEvent({ event, ...properties }) {
      if (event !== "viewer_opened") return track(event, properties, "viewer");
      // Live reloads load the page again; only the first load says this spec was seen.
      if (opened) return;
      opened = true;
      track(
        event,
        { seconds_after_serve: Math.round((Date.now() - readyAt) / 1000) },
        "viewer",
      );
    },
  });
  readyAt = Date.now();
  if (started instanceof Error) {
    track("serve_result", { ok: false, error: started.name });
    return c.error({
      code: "DIFFMAP",
      message: `Failed to serve ${c.args.file}: ${started.message.replace(/^diffmap /, "")}`,
    });
  }
  // How many of each fence kind the spec uses across its pages (a kind it never uses is left out), to see which parts of the guide agents follow.
  const contents: Record<string, number> = {
    pages: started.documents.length,
    references: started.documents.reduce(
      (sum, document) => sum + document.references.length,
      0,
    ),
  };
  const { collectFences } = await import("./parseViewer.js");
  for (const document of started.documents) {
    for (const fence of collectFences(document.nodes))
      contents[`fence_${fence.kind}`] =
        (contents[`fence_${fence.kind}`] ?? 0) + 1;
  }
  track("serve_result", { ok: true, ...contents });
  const output = {
    url: started.url,
    file: started.filePath,
    ...(started.warnings.length > 0 ? { warnings: started.warnings } : {}),
  };
  if (c.formatExplicit) yield output;
  else {
    const pages = started.documents.length;
    const counts = [`${pages} page${pages === 1 ? "" : "s"}`];
    if (started.warnings.length > 0)
      counts.push(
        `${started.warnings.length} warning${started.warnings.length === 1 ? "" : "s"}`,
      );
    yield [
      `Serving ${c.args.file} at ${started.url} (${counts.join(", ")})`,
      ...started.warnings.map((warning) => `Warning: ${warning}`),
      "Stop with Ctrl+C or Close server in the viewer.",
    ].join("\n");
  }
  await started.closed;
  return output;
}

const cli = Cli.create("product-doc", {
  description:
    "Explain systems, plan work, and review changes as visual documents",
  version: packageVersion,
  // The curated authoring skill is installed separately, not generated from commands.
  sync: false,
  args: serveArgs,
  options: serveOptions,
  output: serveOutput,
  hint: "`guide` prints how to write a spec. A spec is a directory of Markdown pages, such as `.diffmap/specs/<name>/`. `validate <spec>` checks it without starting a server. `serve <spec>` runs the local viewer. `share <spec>` publishes an unlisted gist. `update` (or `--update`) installs the latest product-doc.",
  examples: [
    {
      args: { file: ".diffmap/specs/sessions/" },
      description: "Same as `product-doc serve .diffmap/specs/sessions/`",
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
        args: { file: ".diffmap/specs/sessions/" },
        description: "Open the local viewer",
      },
    ],
    run: runServe,
  })
  .command("validate", {
    description:
      "Check a spec's syntax, diagrams, and annotations without starting a server",
    args: serveArgs,
    output: z.object({
      file: z.string(),
      valid: z.literal(true),
      pages: z.array(z.string()),
    }),
    async run(c) {
      trackCommand("validate");
      const { parseSpec, readSpec } = await import("./readSpec.js");
      const file = resolveFromInvokeCwd(c.args.file);
      const read = await readSpec(file);
      const result = read instanceof Error ? read : parseSpec(read);
      if (result instanceof Error)
        return c.error({ code: "DIFFMAP", message: result.message });
      return c.ok({
        file,
        valid: true,
        pages: result.map((page) => page.file),
      });
    },
  });

// Sharing to productdoc.dev is internal for now: setting PRODUCTDOC_ORIGIN swaps
// the gist `share` for it and adds `login` and `logout`.
if (process.env.PRODUCTDOC_ORIGIN === undefined) {
  cli.command("share", {
    description:
      "Publish an unlisted gist and print https://diffmap.dev/g/<id>",
    args: serveArgs,
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
        args: { file: ".diffmap/specs/sessions/" },
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
  });
} else {
  cli
    .command("share", {
      description:
        "Upload a document to productdoc.dev and print its public link. Signs in the first time",
      args: serveArgs,
      options: z.object({
        allow: z
          .array(z.string())
          .optional()
          .describe(
            "Share a file the privacy check stopped, after checking it holds nothing private. Repeat for more files",
          ),
        stop: z
          .boolean()
          .optional()
          .describe(
            "Stop sharing: delete the link in the document's .productdoc.json",
          ),
      }),
      output: z.union([
        z.object({
          id: z.string(),
          link: z.string(),
          publicSourceFiles: z.array(z.string()),
          pages: z.number(),
          media: z.number(),
          bytes: z.number(),
        }),
        z.object({ link: z.string(), stopped: z.literal(true) }),
      ]),
      examples: [
        {
          args: { file: ".diffmap/specs/sessions/" },
          description: "Public link → https://productdoc.dev/d/<id>",
        },
        {
          args: { file: ".diffmap/specs/sessions/" },
          options: { stop: true },
          description: "Delete the link",
        },
      ],
      async run(c) {
        trackCommand("share");
        const dir = resolveFromInvokeCwd(c.args.file);
        const { productdocOrigin } = await import("./publish/auth.js");
        const { shareDocument, stopSharing } =
          await import("./publish/share.js");
        const result =
          c.options.stop === true
            ? await stopSharing({
                dir,
                origin: productdocOrigin(),
                log: progress,
              })
            : await shareDocument({
                dir,
                workspaceRoot: resolveFromInvokeCwd("."),
                origin: productdocOrigin(),
                allow: (c.options.allow ?? []).map((file) =>
                  resolveFromInvokeCwd(file),
                ),
                log: progress,
              });
        if (result instanceof Error)
          return c.error({ code: "DIFFMAP", message: result.message });
        return c.ok(result);
      },
    })
    .command("login", {
      description:
        "Sign in to productdoc.dev with Google or GitHub, so share can upload",
      output: z.object({ email: z.string() }),
      async run(c) {
        trackCommand("login");
        const { login, productdocOrigin } = await import("./publish/auth.js");
        const result = await login({
          origin: productdocOrigin(),
          log: progress,
        });
        if (result instanceof Error)
          return c.error({ code: "DIFFMAP", message: result.message });
        return c.ok(result);
      },
    })
    .command("logout", {
      description: "Sign out of productdoc.dev on this machine",
      output: z.object({
        signedOut: z.boolean(),
        email: z.string().optional(),
      }),
      async run(c) {
        trackCommand("logout");
        const { logout, productdocOrigin } = await import("./publish/auth.js");
        return c.ok(await logout(productdocOrigin()));
      },
    });
}

cli
  .command("guide", {
    description: "Print the instructions agents follow to write a spec",
    args: z.object({
      topic: z
        .enum(guideTopics)
        .optional()
        .describe(
          "A part the main guide sends you to: services, callstack, mermaid, or code (block syntax), previews (live preview and flow blocks), or ui (showing a UI change)",
        ),
    }),
    output: z.string(),
    run(c) {
      trackCommand("guide");
      return readFileSync(
        new URL(
          c.args.topic === undefined
            ? "../guide.md"
            : `../guide/${c.args.topic}.md`,
          import.meta.url,
        ),
        "utf8",
      );
    },
  })
  .command("list", {
    description: "List running productdoc viewers",
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
    description: `Update product-doc to the latest ${packageName} on npm (same as --update)`,
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

const argv = resolveUpdateArgv(process.argv.slice(2));
// Incur has no MCP opt-out. Block its entry points before dispatch; do not
// mistake an option value or a spec passed to `serve` for a command.
const valueOptions = new Set([
  "--port",
  "--root",
  "--format",
  "--filter-output",
  "--token-limit",
  "--token-offset",
]);
let command: string | undefined;
for (let index = 0; index < argv.length; index++) {
  const arg = argv[index]!;
  if (arg === "--") break;
  if (valueOptions.has(arg)) {
    index++;
    continue;
  }
  if (arg.startsWith("-") || arg === "product-doc") continue;
  command = arg;
  break;
}
if (argv.includes("--mcp") || command === "mcp") {
  if (!process.env.COMPLETE) {
    process.stderr.write(
      "MCP is not supported by product-doc. Run product-doc --help.\n",
    );
    exitAfterTelemetry(1);
  }
} else {
  await cli.serve(argv, {
    exit: exitAfterTelemetry,
    stdout(output) {
      if (process.env.COMPLETE && argv.length > 0) {
        // Keep Incur's shell-specific encoding and all non-MCP candidates.
        if (process.env.COMPLETE === "nushell") {
          output = JSON.stringify(
            (JSON.parse(output) as { value: string }[]).filter(
              (candidate) => candidate.value !== "mcp",
            ),
          );
        } else {
          const separator = process.env.COMPLETE === "bash" ? "\v" : "\n";
          output = output
            .split(separator)
            .filter(
              (candidate) =>
                candidate !== "mcp\x01" && !/^mcp(?:[:\t]|$)/.test(candidate),
            )
            .join(separator);
        }
      } else if (
        argv.includes("--help") ||
        argv.includes("-h") ||
        (argv.length === 0 && process.stdout.isTTY)
      ) {
        output = output.replace(/^  (?:mcp|--mcp)\s.*\n/gm, "");
      } else if (
        output.includes("COMMAND_NOT_FOUND") &&
        output.includes("Did you mean 'mcp'?")
      ) {
        process.stderr.write(
          `Unknown command ${JSON.stringify(command)}. Run product-doc --help.\n`,
        );
        return;
      }
      process.stdout.write(output);
    },
  });
}
