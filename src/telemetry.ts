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

let pending: Promise<unknown> | undefined;

/** Exits once the event is sent or times out, so a failing command still reports its run. */
export function exitAfterTelemetry(code: number) {
  void Promise.resolve(pending).then(() => process.exit(code));
}

/** Sends one anonymous `command_run` event without delaying the command. */
export function trackCommand(command: string) {
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
  const distinctId = readOrCreateAnonymousId();
  if (distinctId instanceof Error) return;
  // The open request keeps a short command's process alive for at most a second.
  // Not `fetch`: after its abort it holds the socket until a 10 s connect timeout.
  const request = https.request(posthogUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(1000),
  });
  request.on("error", () => undefined);
  pending = new Promise((resolve) => request.on("close", resolve));
  request.end(
    JSON.stringify({
      api_key: posthogKey,
      event: "command_run",
      distinct_id: distinctId,
      properties: {
        command,
        version: packageVersion,
        os: process.platform,
        arch: process.arch,
        node: process.version,
      },
    }),
  );
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
    "diffmap sends anonymous usage data (command, version, OS). Set DIFFMAP_TELEMETRY=0 to turn it off: https://github.com/tanishqkancharla/diffmap#telemetry\n",
  );
  return id;
}
