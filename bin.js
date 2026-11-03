#!/usr/bin/env node
import module from "node:module";

// Reuse V8's compiled code across runs (Node 22.1+), from the system temp directory.
module.enableCompileCache?.();
await import("./lib/cli.js");
