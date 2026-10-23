import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  changedFileItem,
  revWindow,
  windowLabel,
  windowRev,
  type Changes,
  type Delta,
  type DeltaWindow,
} from "./changes.js";
import { listDeltas, readChanges, readDocumentChanges } from "./git.js";

const execFileAsync = promisify(execFile);

test("range labels run from the diff base to its destination", () => {
  const deltas: Delta[] = [
    { kind: "unstaged", additions: 1, deletions: 0 },
    { kind: "staged", additions: 1, deletions: 0 },
    {
      kind: "commit",
      sha: "cccccccc",
      parent: "bbbbbbbb",
      subject: "Newest",
      additions: 1,
      deletions: 0,
    },
    {
      kind: "commit",
      sha: "bbbbbbbb",
      parent: "aaaaaaaa",
      subject: "Oldest",
      additions: 1,
      deletions: 0,
    },
    {
      kind: "commit",
      sha: "aaaaaaaa",
      parent: "00000000",
      subject: "Base",
      additions: 1,
      deletions: 0,
    },
  ];
  assert.equal(
    windowLabel(deltas, { newest: 2, oldest: 3 }),
    "aaaaaaa…ccccccc",
  );
  assert.equal(windowLabel(deltas, { newest: 1, oldest: 3 }), "aaaaaaa…Staged");
  assert.equal(
    windowLabel(deltas, { newest: 0, oldest: 3 }),
    "aaaaaaa…Unstaged",
  );
  assert.equal(
    windowLabel(deltas, { newest: 0, oldest: 1 }),
    "Staged…Unstaged",
  );
  assert.equal(windowLabel(deltas, { newest: 2, oldest: 2 }), "Newest");
  assert.equal(windowLabel(deltas, { newest: 0, oldest: 4 }), "All commits");
});

async function withRepo(
  run: (
    root: string,
    git: (...args: string[]) => Promise<string>,
  ) => Promise<void>,
) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-git-"));
  const git = async (...args: string[]) =>
    (await execFileAsync("git", args, { cwd: root })).stdout.trim();
  const write = (file: string, contents: string) =>
    fs.writeFile(path.join(root, file), contents);
  try {
    await git("init", "-q");
    await git("config", "user.email", "test@example.com");
    await git("config", "user.name", "Test");
    await write("keep.ts", "one\ntwo\nthree\n");
    await write("old-name.ts", "export const a = 1;\nexport const b = 2;\n");
    await write("gone.ts", "bye\n");
    await git("add", ".");
    await git("commit", "-qm", "Initial");
    await run(root, git);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

/** Compares what the viewer receives over JSON. */
function summary(changes: Changes) {
  return (JSON.parse(JSON.stringify(changes)) as Changes).files
    .map((file) => ({
      path: file.path,
      prevPath: file.prevPath,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      contents: file.contents,
    }))
    .toSorted((a, b) => a.path.localeCompare(b.path));
}

test("readChanges reads a commit's added, modified, renamed, and deleted files", async () => {
  await withRepo(async (root, git) => {
    const initial = await git("rev-parse", "HEAD");
    await fs.writeFile(path.join(root, "keep.ts"), "one\nTWO\nthree\nfour\n");
    await git("mv", "old-name.ts", "new-name.ts");
    await git("rm", "-q", "gone.ts");
    await fs.writeFile(path.join(root, "added.ts"), "new\n");
    await git("add", ".");
    await git("commit", "-qm", "Change things");
    const head = await git("rev-parse", "HEAD");

    const changes = await readChanges(root, head.slice(0, 7));
    assert.equal(changes instanceof Error, false);
    if (changes instanceof Error) return;
    assert.equal(changes.title, "Change things");
    assert.deepEqual(summary(changes), [
      {
        path: "added.ts",
        prevPath: undefined,
        status: "added",
        additions: 1,
        deletions: 0,
        contents: { new: "new\n" },
      },
      {
        path: "gone.ts",
        prevPath: undefined,
        status: "deleted",
        additions: 0,
        deletions: 1,
        contents: { old: "bye\n" },
      },
      {
        path: "keep.ts",
        prevPath: undefined,
        status: "modified",
        additions: 2,
        deletions: 1,
        contents: { old: "one\ntwo\nthree\n", new: "one\nTWO\nthree\nfour\n" },
      },
      {
        path: "new-name.ts",
        prevPath: "old-name.ts",
        status: "renamed",
        additions: 0,
        deletions: 0,
        contents: {
          old: "export const a = 1;\nexport const b = 2;\n",
          new: "export const a = 1;\nexport const b = 2;\n",
        },
      },
    ]);

    // The root commit diffs against the empty tree.
    const rootCommit = await readChanges(root, initial);
    assert.equal(rootCommit instanceof Error, false);
    if (rootCommit instanceof Error) return;
    assert.deepEqual(
      summary(rootCommit).map((file) => [file.path, file.status]),
      [
        ["gone.ts", "added"],
        ["keep.ts", "added"],
        ["old-name.ts", "added"],
      ],
    );

    const range = await readChanges(
      root,
      `${initial.slice(0, 7)}..${head.slice(0, 7)}`,
    );
    assert.equal(range instanceof Error, false);
    if (range instanceof Error) return;
    assert.equal(
      range.title,
      `${initial.slice(0, 7)}..${head.slice(0, 7)} · 1 commit`,
    );
    assert.equal(range.files.length, 4);

    assert.equal((await readChanges(root, "abcdef1")) instanceof Error, true);
    assert.equal((await readChanges(root, "HEAD")) instanceof Error, true);
  });
});

test("readChanges working includes staged, unstaged, deleted, and untracked files", async () => {
  await withRepo(async (root, git) => {
    await fs.writeFile(path.join(root, "keep.ts"), "one\ntwo\nthree\nstaged\n");
    await git("add", "keep.ts");
    await fs.writeFile(
      path.join(root, "keep.ts"),
      "one\ntwo\nthree\nstaged\nunstaged\n",
    );
    await fs.rm(path.join(root, "gone.ts"));
    await fs.writeFile(path.join(root, "fresh.ts"), "a\nb\n");

    const changes = await readChanges(root, "working");
    assert.equal(changes instanceof Error, false);
    if (changes instanceof Error) return;
    assert.equal(changes.title, "Uncommitted changes");
    assert.deepEqual(
      summary(changes).map((file) => [
        file.path,
        file.status,
        file.additions,
        file.deletions,
        file.contents?.new,
      ]),
      [
        ["fresh.ts", "added", 2, 0, "a\nb\n"],
        ["gone.ts", "deleted", 0, 1, undefined],
        ["keep.ts", "modified", 2, 0, "one\ntwo\nthree\nstaged\nunstaged\n"],
      ],
    );
  });
});

test("readChanges working shows a path removed from the index but kept on disk once", async () => {
  await withRepo(async (root, git) => {
    // keep.ts is unchanged on disk, so it is not a change at all.
    await git("rm", "-q", "--cached", "keep.ts", "gone.ts");
    await fs.writeFile(path.join(root, "gone.ts"), "bye\nagain\n");

    const changes = await readChanges(root, "working");
    assert.equal(changes instanceof Error, false, String(changes));
    if (changes instanceof Error) return;
    assert.deepEqual(
      summary(changes).map((file) => [
        file.path,
        file.status,
        file.additions,
        file.deletions,
        file.contents,
      ]),
      [["gone.ts", "modified", 1, 0, { old: "bye\n", new: "bye\nagain\n" }]],
    );
  });
});

test("readChanges reads a symlink as its target path, not the file it points to", async () => {
  await withRepo(async (root) => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "diffmap-secret-"));
    try {
      await fs.writeFile(path.join(outside, "secret.txt"), "secret\n");
      await fs.symlink(
        path.join(outside, "secret.txt"),
        path.join(root, "link.txt"),
      );
      const changes = await readChanges(root, "working");
      assert.equal(changes instanceof Error, false, String(changes));
      if (changes instanceof Error) return;
      assert.deepEqual(
        changes.files.map((file) => [file.path, file.contents?.new]),
        [["link.txt", path.join(outside, "secret.txt")]],
      );
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});

test("readChanges names files relative to a root below the repository's top level", async () => {
  await withRepo(async (root, git) => {
    await fs.mkdir(path.join(root, "pkg"));
    await fs.writeFile(path.join(root, "pkg", "a.ts"), "a\n");
    await git("add", ".");
    await git("commit", "-qm", "Add a");
    const sha = await git("rev-parse", "HEAD");
    await fs.writeFile(path.join(root, "pkg", "a.ts"), "a\nb\n");
    await fs.writeFile(path.join(root, "keep.ts"), "outside\n");

    const pkg = path.join(root, "pkg");
    const commit = await readChanges(pkg, sha);
    const working = await readChanges(pkg, "working");
    assert.equal(commit instanceof Error, false, String(commit));
    assert.equal(working instanceof Error, false, String(working));
    if (commit instanceof Error || working instanceof Error) return;
    assert.deepEqual(
      summary(commit).map((file) => [file.path, file.status]),
      [["a.ts", "added"]],
    );
    assert.deepEqual(
      summary(working).map((file) => [file.path, file.status, file.contents]),
      [["a.ts", "modified", { old: "a\n", new: "a\nb\n" }]],
    );
  });
});

test("readDocumentChanges rejects unchanged files and ranges past the end", async () => {
  await withRepo(async (root, git) => {
    await fs.writeFile(path.join(root, "keep.ts"), "one\ntwo\nthree\nfour\n");
    await git("commit", "-qam", "Add four");
    const sha = (await git("rev-parse", "HEAD")).slice(0, 7);
    const check = (reference: { path: string; start?: number; end?: number }) =>
      readDocumentChanges(root, {
        changeCards: [],
        references: [{ kind: "file", rev: sha, ...reference }],
      });

    const ok = await check({ path: "keep.ts", start: 4, end: 4 });
    assert.equal(ok instanceof Error, false);
    if (ok instanceof Error) return;
    assert.deepEqual([...ok.keys()], [sha]);

    const pastEnd = await check({ path: "keep.ts", start: 4, end: 5 });
    assert.match(
      pastEnd instanceof Error ? pastEnd.message : "",
      /past the end of keep\.ts \(4 lines\)/,
    );

    const unchanged = await check({ path: "gone.ts" });
    assert.match(
      unchanged instanceof Error ? unchanged.message : "",
      /gone\.ts is not changed/,
    );

    const review = (paths: string[]) =>
      readDocumentChanges(root, {
        changeCards: [{ rev: sha, review: paths }],
        references: [],
      });
    assert.equal((await review(["keep.ts"])) instanceof Error, false);
    const missing = await review(["keep.ts", "gone.ts"]);
    assert.match(
      missing instanceof Error ? missing.message : "",
      /lists gone\.ts to review, but it is not changed/,
    );
  });
});

test("listDeltas lists a branch's commits, and picked windows read the right files", async () => {
  await withRepo(async (root, git) => {
    const write = (file: string, contents: string) =>
      fs.writeFile(path.join(root, file), contents);
    await git("branch", "-M", "main");
    await git("checkout", "-qb", "feature");
    await write("first.ts", "1\n");
    await git("add", ".");
    await git("commit", "-qm", "First");
    await write("second.ts", "2\n");
    await git("add", ".");
    await git("commit", "-qm", "Second");
    await write("staged.ts", "s\n");
    await git("add", "staged.ts");
    await write("keep.ts", "one\ntwo\nthree\nunstaged\n");

    const deltas = await listDeltas(root);
    assert.equal(deltas instanceof Error, false);
    if (deltas instanceof Error) return;
    // The initial commit is on main, so the list stops at the branch point.
    assert.deepEqual(
      deltas.map((delta) =>
        delta.kind === "commit" ? delta.subject : delta.kind,
      ),
      ["unstaged", "staged", "Second", "First"],
    );
    assert.deepEqual(
      deltas.slice(0, 2).map((delta) => [delta.additions, delta.deletions]),
      [
        [1, 0],
        [1, 0],
      ],
    );

    // An open commit before the branch point extends the list down to it.
    const initial = await git("rev-parse", "main");
    const reaching = await listDeltas(root, initial.slice(0, 7));
    assert.equal(reaching instanceof Error, false);
    if (reaching instanceof Error) return;
    assert.deepEqual(
      reaching.map((delta) =>
        delta.kind === "commit" ? delta.subject : delta.kind,
      ),
      ["unstaged", "staged", "Second", "First", "Initial"],
    );
    assert.deepEqual(revWindow(reaching, initial.slice(0, 7)), {
      newest: 4,
      oldest: 4,
    });
    // Picking every row of the extended list keeps its oldest commit.
    const everything = { newest: 0, oldest: reaching.length - 1 };
    const whole = windowRev(reaching, everything);
    assert.deepEqual(revWindow(reaching, whole), everything);
    const wholeChanges = await readChanges(root, whole);
    assert.equal(wholeChanges instanceof Error, false, String(wholeChanges));
    if (wholeChanges instanceof Error) return;
    assert.equal(
      wholeChanges.files.some((file) => file.path === "gone.ts"),
      true,
    );

    const filesFor = async (window: DeltaWindow) => {
      const rev = windowRev(deltas, window);
      // Every window maps back to the same rows, so the picker can show what a rev covers.
      assert.deepEqual(revWindow(deltas, rev), window);
      const changes = await readChanges(root, rev);
      assert.equal(changes instanceof Error, false, String(changes));
      if (changes instanceof Error) return [];
      return changes.files.map((file) => file.path).toSorted();
    };
    assert.deepEqual(await filesFor({ newest: 2, oldest: 3 }), [
      "first.ts",
      "second.ts",
    ]);
    assert.deepEqual(await filesFor({ newest: 3, oldest: 3 }), ["first.ts"]);
    assert.deepEqual(await filesFor({ newest: 1, oldest: 3 }), [
      "first.ts",
      "second.ts",
      "staged.ts",
    ]);
    assert.deepEqual(await filesFor({ newest: 1, oldest: 1 }), ["staged.ts"]);
    assert.deepEqual(await filesFor({ newest: 0, oldest: 0 }), ["keep.ts"]);
    assert.deepEqual(await filesFor({ newest: 0, oldest: 1 }), [
      "keep.ts",
      "staged.ts",
    ]);
    assert.deepEqual(await filesFor({ newest: 0, oldest: 3 }), [
      "first.ts",
      "keep.ts",
      "second.ts",
      "staged.ts",
    ]);
  });
});

/** Whether a diff item shows a new-side line inside a hunk. */
function covers(item: ReturnType<typeof changedFileItem>, line: number) {
  return (
    item?.type === "diff" &&
    item.fileDiff.hunks.some(
      (hunk) =>
        line >= hunk.additionStart &&
        line < hunk.additionStart + hunk.additionCount,
    )
  );
}

test("changedFileItem shows a focused range that sits in unchanged code", () => {
  const lines = Array.from(
    { length: 100 },
    (_, index) => `line ${String(index + 1)}`,
  );
  const old = `${lines.join("\n")}\n`;
  const next = old.replace("line 90\n", "line ninety\n");
  const file = {
    path: "a.ts",
    status: "modified" as const,
    additions: 1,
    deletions: 1,
    binary: false,
    contents: { old, new: next },
  };
  assert.equal(covers(changedFileItem(file), 10), false);
  const focused = changedFileItem(file, { start: 10, end: 12 });
  assert.equal(covers(focused, 10) && covers(focused, 12), true);
  // A new version makes Pierre reread the widened item.
  assert.notEqual(focused?.version, changedFileItem(file)?.version);
});
