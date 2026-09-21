#!/usr/bin/env -S node --import tsx

import { Cli, z } from "incur";
import { resolveFromInvokeCwd } from "./invokeCwd.js";
import { packageVersion } from "./packageVersion.js";
import { listRunningDiffmaps } from "./registry.js";
import { startServer } from "./serve.js";
import { shareMarkdownFile } from "./share.js";

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
});

type ServeContext = {
  args: { file: string };
  options: { port?: number | undefined; root?: string | undefined };
  error: (input: { code: string; message: string }) => never;
};

async function* runServe(c: ServeContext) {
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
  yield { url: started.url, file: started.filePath };
  await started.closed;
  return { url: started.url, file: started.filePath };
}

const cli = Cli.create("diffmap", {
  description: "Serve a spec locally, or share it as a gist",
  version: packageVersion,
  args: serveArgs,
  options: serveOptions,
  output: serveOutput,
  hint: "`serve <spec.md>` runs the local viewer. `share <spec.md>` publishes a secret gist.",
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
  .command("share", {
    description: "Publish a secret gist and print https://diffmap.dev/g/<id>",
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
        description: "Secret gist → https://diffmap.dev/g/<id>",
      },
    ],
    async run(c) {
      const shared = await shareMarkdownFile({
        filePath: resolveFromInvokeCwd(c.args.file),
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
      const instances = await listRunningDiffmaps();
      if (instances instanceof Error) {
        return c.error({
          code: "DIFFMAP",
          message: instances.message,
        });
      }
      return c.ok({ instances });
    },
  });

await cli.serve();
