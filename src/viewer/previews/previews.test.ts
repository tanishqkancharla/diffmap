import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readDiffmapConfig } from "../../diffmapConfig.js";
import { parseFlow } from "../../parseFence.js";
import { parseViewerDocument } from "../../parseViewer.js";
import { storyLabel, storyLabelFromId } from "./config.ts";
import { layoutFlow, stateChildren, statePath } from "./flowTree.ts";

const logIn = [
  "auth-log-in--empty",
  "  auth-log-in--filled: Fill in email and password",
  "    auth-log-in--wrong-password: Log in with the wrong password",
  "    auth-log-in--two-factor: Log in to a 2-factor account",
  "      auth-log-in--signed-in: Enter the code",
  '  auth-log-in--forgot: Click "Forgot password?"',
].join("\n");

test("a flow is a tree of stories, each reached by one action from the state above it", () => {
  const { states, problem } = parseFlow(logIn);
  assert.equal(problem, undefined);
  assert.deepEqual(
    states.map((state) => [state.story, state.parent, state.action]),
    [
      ["auth-log-in--empty", undefined, undefined],
      ["auth-log-in--filled", 0, "Fill in email and password"],
      ["auth-log-in--wrong-password", 1, "Log in with the wrong password"],
      ["auth-log-in--two-factor", 1, "Log in to a 2-factor account"],
      ["auth-log-in--signed-in", 3, "Enter the code"],
      ["auth-log-in--forgot", 0, 'Click "Forgot password?"'],
    ],
  );
  assert.deepEqual(statePath(states, 4), [
    "auth-log-in--empty",
    "auth-log-in--filled",
    "auth-log-in--two-factor",
    "auth-log-in--signed-in",
  ]);
  assert.deepEqual(stateChildren(states, 1), [2, 3]);
});

test("a flow names what is wrong with it", () => {
  for (const [source, reason] of [
    ["", "at least its starting story"],
    ["auth-log-in--empty: Open the page", "is the starting state"],
    ["auth-log-in--empty\n  auth-log-in--filled", "needs the action"],
    ["auth-log-in--empty\nauth-log-in--filled: Fill", "is not indented"],
    ["auth-log-in--empty\n  Filled: Fill", "is not a Storybook story ID"],
    [
      "auth-log-in--empty\n  auth-log-in--filled: Fill\n  auth-log-in--filled: Again",
      "twice",
    ],
  ] as const) {
    assert.match(parseFlow(source).problem ?? "", new RegExp(reason));
  }
  assert.match(
    String(
      parseViewerDocument(
        "# Log in\n\n```flow\nauth-log-in--empty\n  auth-log-in--filled\n```\n",
        "spec.md",
      ),
    ),
    /needs the action/,
  );
  assert.match(
    String(
      parseViewerDocument("# Buttons\n\n```preview\nPrimary\n```\n", "spec.md"),
    ),
    /is not a Storybook story ID/,
  );
});

test("the map puts each state right of the one it follows, centered on its own states", () => {
  const { states } = parseFlow(logIn);
  const layout = layoutFlow(states);
  assert.equal(layout.columns, 4);
  assert.equal(layout.rows, 3);
  const at = (index: number) => layout.placements[index]!;
  assert.deepEqual(
    states.map((_, index) => at(index).column),
    [0, 1, 2, 2, 3, 1],
  );
  assert.equal(at(4).row, at(3).row);
  assert.ok(at(1).row > at(2).row && at(1).row < at(3).row);
  assert.ok(at(0).row > at(1).row && at(0).row < at(5).row);
});

test("stories read by name, from the page or from their IDs", () => {
  assert.equal(storyLabel("WrongPassword"), "Wrong Password");
  assert.equal(storyLabel("TwoFactor"), "Two Factor");
  assert.equal(
    storyLabelFromId("auth-log-in--wrong-password"),
    "Wrong Password",
  );
});

test(".diffmap/config.json is found above the spec and checked", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-config-"));
  const spec = path.join(root, ".diffmap", "specs", "login");
  await fs.mkdir(spec, { recursive: true });
  assert.deepEqual(await readDiffmapConfig(spec), {
    file: undefined,
    config: {},
  });

  const file = path.join(root, ".diffmap", "config.json");
  const config = {
    previews: { local: "http://127.0.0.1:5200/previews.html" },
    flows: { transitions: "render", viewport: { width: 1024, height: 720 } },
  };
  await fs.writeFile(file, JSON.stringify(config));
  assert.deepEqual(await readDiffmapConfig(spec), { file, config });

  await fs.writeFile(
    file,
    JSON.stringify({ flows: { transitions: "animate" } }),
  );
  const wrong = await readDiffmapConfig(spec);
  assert.ok("error" in wrong);
});
