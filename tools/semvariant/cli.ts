// Adapted from cashew-labs/halo at 536cffe316681229cbb4b76984dfe98299572672.
// Copyright 2026 Saffron Health, Inc. Licensed under Apache-2.0; see LICENSE.
// Modified for diffmap's npm/tsx execution. See NOTICE for provenance.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runSemvariant } from "./semvariant.ts";

// tsx runs this repository-only tool without adding it to the product build.
const root = realpathSync(fileURLToPath(new URL("../..", import.meta.url)));
const result = runSemvariant(root, process.argv.slice(2));
if (result instanceof Error) {
  console.error(result.message);
  process.exitCode = 1;
} else {
  console.log(result);
}
