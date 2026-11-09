import { randomUUID } from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import * as errore from "errore";
import { DiffmapTelemetryError } from "./errors.js";
import { packageVersion } from "./packageVersion.js";

// A PostHog project key can only send events, so it is safe to publish.
const posthogKey = "phc_wmzP7VyBQzTLwsSoGtyxNDvqHUDRpi7NofcTaYBW9pjv";
const posthogUrl = "https://us.i.posthog.com/i/v0/e/";

const pending = new Set<Promise<unknown>>();
let distinctId: string | Error | undefined;

/** Exits once every event is sent or times out, so a failing command still reports its run. */
export function exitAfterTelemetry(code: number) {
  void Promise.all(pending).then(() => process.exit(code));
}

/** Sends one anonymous `command_run` event without delaying the command. */
export function trackCommand(command: string) {
  track("command_run", { command });
}

/** Sends one anonymous event without delaying the command; properties must never hold paths or spec contents. */
export function track(
  event: string,
  properties: Record<string, string | number | boolean> = {},
) {
  const env = process.env;
  const optedOut =
    (env.DO_NOT_TRACK !== undefined &&
      env.DO_NOT_TRACK !== "" &&
      env.DO_NOT_TRACK !== "0") ||
    env.DIFFMAP_TELEMETRY === "0" ||
    env.DIFFMAP_TELEMETRY === "false" ||
    env.DIFFMAP_DEV === "1" ||
    (env.CI !== undefined && env.CI !== "");
  if (optedOut) return;
  distinctId ??= readOrCreateAnonymousId();
  if (distinctId instanceof Error) return;
  // The open request keeps a short command's process alive for at most a second.
  // Not `fetch`: after its abort it holds the socket until a 10 s connect timeout.
  const request = https.request(posthogUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(1000),
  });
  request.on("error", () => undefined);
  const sent = new Promise((resolve) => request.on("close", resolve));
  pending.add(sent);
  void sent.then(() => pending.delete(sent));
  request.end(
    JSON.stringify({
      api_key: posthogKey,
      event,
      distinct_id: distinctId,
      properties: {
        ...properties,
        version: packageVersion,
        os: process.platform,
        arch: process.arch,
        node: process.version,
        invoked_by: detectInvoker(env),
      },
    }),
  );
}

/** The coding agent running diffmap, from the variables agents set for their commands; their values are never sent. */
function detectInvoker(env: NodeJS.ProcessEnv) {
  if (
    env.AMP_CURRENT_THREAD_ID ||
    env.AI_AGENT === "amp" ||
    env.AGENT === "amp"
  )
    return "amp";
  if (env.CLAUDECODE) return "claude-code";
  if (env.CODEX_THREAD_ID || env.CODEX_CI || env.CODEX_SANDBOX) return "codex";
  if (env.CURSOR_AGENT) return "cursor";
  if (env.GEMINI_CLI) return "gemini-cli";
  if (env.OPENCODE) return "opencode";
  if (env.AI_AGENT || env.AGENT) return "other-agent";
  // Agents run commands without a terminal; a supervisor or script does too.
  return process.stdout.isTTY ? "terminal" : "unknown";
}

/** Reads the random ID from the config directory, creating it and printing the notice on first run. */
function readOrCreateAnonymousId() {
  const configHome =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  const idPath = path.join(configHome, "diffmap", "telemetry-id");
  const existing = errore.try({
    try: () => fs.readFileSync(idPath, "utf8").trim(),
    catch: (cause) => new DiffmapTelemetryError({ reason: "read id", cause }),
  });
  if (!(existing instanceof Error) && existing !== "") return existing;

  const id = randomUUID();
  const written = errore.try({
    try: () => {
      fs.mkdirSync(path.dirname(idPath), { recursive: true });
      fs.writeFileSync(idPath, `${id}\n`);
    },
    catch: (cause) => new DiffmapTelemetryError({ reason: "write id", cause }),
  });
  if (written instanceof Error) return written;
  process.stderr.write(
    "diffmap sends anonymous usage data (commands, viewer actions, version, OS). Set DIFFMAP_TELEMETRY=0 to turn it off: https://github.com/tanishqkancharla/diffmap#telemetry\n",
  );
  return id;
}
