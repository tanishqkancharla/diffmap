#!/usr/bin/env -S node --import tsx

import { Cli, z } from "incur";
import { resolveFromInvokeCwd } from "./invokeCwd.js";
import { listRunningDiffmaps } from "./registry.js";
import { startServer } from "./serve.js";
import { shareMarkdownFile } from "./share.js";

const cli = Cli.create("diffmap", {
  description: "Serve a spec or code walkthrough as a local page",
  version: "0.1.3",
  args: z.object({
    file: z.string().describe("Path to the markdown file"),
  }),
  options: z.object({
    port: z.coerce.number().optional().describe("Port (default 4177)"),
    root: z.string().optional().describe("Workspace root for file excerpts"),
  }),
  output: z.object({
    url: z.string(),
    file: z.string(),
  }),
  async *run(c) {
    const started = await startServer({
      filePath: resolveFromInvokeCwd(c.args.file),
      workspaceRoot:
        c.options.root === undefined
          ? resolveFromInvokeCwd(".")
          : resolveFromInvokeCwd(c.options.root),
      port: c.options.port === undefined ? 4177 : c.options.port,
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
  })
  .command("share", {
    description: "Upload a walkthrough gist and print the diffmap.dev URL",
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
  });

await cli.serve();
