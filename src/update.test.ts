import assert from "node:assert/strict";
import test from "node:test";
import {
  compareVersions,
  detectInstallMethodFromPath,
  globalInstallCommand,
  type InstallMethod,
  resolveUpdateArgv,
  runUpdate,
} from "./update.js";

test("compareVersions orders release versions", () => {
  assert.equal(compareVersions("0.1.4", "0.1.4"), 0);
  assert.equal(compareVersions("0.1.4", "0.1.5"), -1);
  assert.equal(compareVersions("0.2.0", "0.1.9"), 1);
  assert.equal(compareVersions("1.0.0", "0.99.99"), 1);
  assert.equal(compareVersions("0.1.10", "0.1.9"), 1);
  assert.equal(compareVersions("v1.2.3", "1.2.3"), 0);
  assert.equal(compareVersions("1.2.3+build.1", "1.2.3"), 0);
});

test("compareVersions follows semver prerelease precedence", () => {
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0"), -1);
  assert.equal(compareVersions("1.0.0", "1.0.0-rc.1"), 1);
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0-alpha.1"), -1);
  assert.equal(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.beta"), -1);
  assert.equal(compareVersions("1.0.0-beta.2", "1.0.0-beta.11"), -1);
  assert.equal(compareVersions("1.0.0-rc.1", "1.0.0-beta.11"), 1);
});

test("compareVersions rejects unparseable versions", () => {
  assert.ok(compareVersions("latest", "0.1.4") instanceof Error);
});

test("resolveUpdateArgv routes --update to the update command", () => {
  assert.deepEqual(resolveUpdateArgv(["update"]), ["update"]);
  assert.deepEqual(resolveUpdateArgv(["--update"]), ["update"]);
  assert.deepEqual(resolveUpdateArgv(["--update", "--format", "json"]), [
    "update",
    "--format",
    "json",
  ]);
  assert.deepEqual(resolveUpdateArgv(["--format", "json", "--update"]), [
    "update",
    "--format",
    "json",
  ]);
  assert.deepEqual(resolveUpdateArgv(["--update", "--help"]), [
    "update",
    "--help",
  ]);
});

test("resolveUpdateArgv leaves other invocations alone", () => {
  assert.deepEqual(resolveUpdateArgv([]), []);
  assert.deepEqual(resolveUpdateArgv(["spec.md"]), ["spec.md"]);
  assert.deepEqual(resolveUpdateArgv(["serve", "spec.md", "--port", "4000"]), [
    "serve",
    "spec.md",
    "--port",
    "4000",
  ]);
  assert.deepEqual(resolveUpdateArgv(["share", "--", "--update"]), [
    "share",
    "--",
    "--update",
  ]);
});

test("detectInstallMethodFromPath recognizes install layouts", () => {
  const entry = "@tanishqkancharla/diffmap/bin.js";
  assert.equal(
    detectInstallMethodFromPath({
      entryPath: `/home/u/.npm/_npx/abc123/node_modules/${entry}`,
      env: {},
    }),
    "npx",
  );
  assert.equal(
    detectInstallMethodFromPath({
      entryPath: "/anywhere/bin.js",
      env: { npm_command: "exec" },
      npmGlobalRoot: "/usr/lib/node_modules",
    }),
    "npx",
  );
  assert.equal(
    detectInstallMethodFromPath({
      entryPath: `/home/u/.bun/install/global/node_modules/${entry}`,
      env: {},
    }),
    "bun",
  );
  assert.equal(
    detectInstallMethodFromPath({
      entryPath: `/home/u/.local/share/pnpm/global/5/.pnpm/pkg/node_modules/${entry}`,
      env: {},
    }),
    "pnpm",
  );
  assert.equal(
    detectInstallMethodFromPath({
      entryPath: `/opt/pnpm-home/global/5/node_modules/${entry}`,
      env: { PNPM_HOME: "/opt/pnpm-home" },
    }),
    "pnpm",
  );
  assert.equal(
    detectInstallMethodFromPath({
      entryPath: `/usr/local/lib/node_modules/${entry}`,
      env: {},
      npmGlobalRoot: "/usr/local/lib/node_modules/",
    }),
    "npm",
  );
  assert.equal(
    detectInstallMethodFromPath({
      entryPath: `C:\\Users\\u\\AppData\\Roaming\\npm\\node_modules\\@tanishqkancharla\\diffmap\\bin.js`,
      env: {},
      npmGlobalRoot: "C:\\Users\\u\\AppData\\Roaming\\npm\\node_modules",
    }),
    "npm",
  );
});

test("detectInstallMethodFromPath returns unknown for checkouts and local installs", () => {
  assert.equal(
    detectInstallMethodFromPath({
      entryPath: "/home/u/src/diffmap/bin.js",
      env: {},
      npmGlobalRoot: "/usr/local/lib/node_modules",
    }),
    "unknown",
  );
  assert.equal(
    detectInstallMethodFromPath({
      entryPath:
        "/home/u/project/node_modules/@tanishqkancharla/diffmap/bin.js",
      env: { npm_command: "run-script" },
      npmGlobalRoot: "/usr/local/lib/node_modules",
    }),
    "unknown",
  );
  assert.equal(
    detectInstallMethodFromPath({
      entryPath: "/usr/local/lib/node_modules/diffmap/bin.js",
      env: {},
      npmGlobalRoot: "/usr/local/lib/node_modules",
    }),
    "unknown",
  );
});

test("global install commands always use the scoped package", () => {
  for (const method of ["npm", "pnpm", "bun"] as const) {
    const install = globalInstallCommand(method);
    assert.equal(install.command, method);
    assert.ok(install.args.includes("@tanishqkancharla/diffmap@latest"));
    assert.ok(!install.args.some((arg) => arg.startsWith("diffmap")));
  }
});

function fakeDeps(input: {
  current: string;
  latest: string | Error;
  method?: InstallMethod;
  install?: Error;
}) {
  const ran: string[] = [];
  let detected = false;
  return {
    ran,
    wasDetected: () => detected,
    deps: {
      currentVersion: input.current,
      fetchLatestVersion: async () => input.latest,
      detectInstallMethod: async () => {
        detected = true;
        return input.method ?? "unknown";
      },
      runCommand: async (command: { command: string; args: string[] }) => {
        ran.push([command.command, ...command.args].join(" "));
        return input.install;
      },
    },
  };
}

test("runUpdate reports already up to date without detecting or installing", async () => {
  for (const latest of ["0.1.4", "0.1.3"]) {
    const fake = fakeDeps({ current: "0.1.4", latest, method: "npm" });
    const result = await runUpdate(fake.deps);
    assert.ok(!(result instanceof Error));
    assert.equal(result.status, "up-to-date");
    assert.match(result.message, /already up to date \(0\.1\.4\)/);
    assert.equal(fake.wasDetected(), false);
    assert.deepEqual(fake.ran, []);
  }
});

test("runUpdate installs globally with the detected package manager", async () => {
  const expected = {
    npm: "npm install --global @tanishqkancharla/diffmap@latest",
    pnpm: "pnpm add --global @tanishqkancharla/diffmap@latest",
    bun: "bun add --global @tanishqkancharla/diffmap@latest",
  } as const;
  for (const method of ["npm", "pnpm", "bun"] as const) {
    const fake = fakeDeps({ current: "0.1.4", latest: "0.2.0", method });
    const result = await runUpdate(fake.deps);
    assert.ok(!(result instanceof Error));
    assert.equal(result.status, "updated");
    assert.equal(result.message, "Updated diffmap from 0.1.4 to 0.2.0");
    assert.deepEqual(fake.ran, [expected[method]]);
  }
});

test("runUpdate prints the command instead of guessing for npx and unknown installs", async () => {
  const npx = fakeDeps({ current: "0.1.4", latest: "0.2.0", method: "npx" });
  const npxResult = await runUpdate(npx.deps);
  assert.ok(!(npxResult instanceof Error));
  assert.equal(npxResult.status, "manual");
  assert.ok("command" in npxResult);
  assert.equal(npxResult.command, "npx @tanishqkancharla/diffmap@latest");
  assert.deepEqual(npx.ran, []);

  const unknown = fakeDeps({ current: "0.1.4", latest: "0.2.0" });
  const unknownResult = await runUpdate(unknown.deps);
  assert.ok(!(unknownResult instanceof Error));
  assert.equal(unknownResult.status, "manual");
  assert.ok("command" in unknownResult);
  assert.equal(
    unknownResult.command,
    "npm install --global @tanishqkancharla/diffmap@latest",
  );
  assert.match(unknownResult.message, /could not tell how it was installed/);
  assert.deepEqual(unknown.ran, []);
});

test("runUpdate surfaces registry and install failures as errors", async () => {
  const offline = fakeDeps({
    current: "0.1.4",
    latest: new Error("could not reach the npm registry"),
  });
  assert.ok((await runUpdate(offline.deps)) instanceof Error);

  const failed = fakeDeps({
    current: "0.1.4",
    latest: "0.2.0",
    method: "npm",
    install: new Error("EACCES"),
  });
  const result = await runUpdate(failed.deps);
  assert.ok(result instanceof Error);
  assert.match(result.message, /EACCES/);
});
