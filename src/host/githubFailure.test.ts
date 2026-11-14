import assert from "node:assert/strict";
import test from "node:test";
import { responseFailure } from "./githubFailure.ts";

test("responseFailure tells an exhausted rate limit from a refusal", () => {
  assert.deepEqual(
    responseFailure(
      new Response("", {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1700000000",
        },
      }),
    ),
    { status: "rate-limited", resetAt: 1_700_000_000_000 },
  );
  assert.deepEqual(responseFailure(new Response("", { status: 403 })), {
    status: "forbidden",
  });
  assert.equal(
    responseFailure(new Response("", { status: 429 }))?.status,
    "rate-limited",
  );
  assert.deepEqual(responseFailure(new Response("", { status: 404 })), {
    status: "not-found",
  });
  assert.equal(responseFailure(new Response("{}", { status: 200 })), undefined);
});
