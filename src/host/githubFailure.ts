/** Why a GitHub API request failed, as diffmap.dev explains it to the reader. */
export type GitHubFailure =
  | { status: "not-found" }
  | { status: "forbidden" }
  /** `resetAt` is when GitHub lets this network make requests again, in ms since the epoch. */
  | { status: "rate-limited"; resetAt?: number }
  | { status: "offline" }
  | { status: "error"; message: string };

/** A failed GitHub request carried through code that returns errors as values. */
export class GitHubRequestError extends Error {
  readonly failure: GitHubFailure;
  constructor(failure: GitHubFailure) {
    super(failureMessage(failure));
    this.failure = failure;
  }
}

/** The failure a GitHub API response stands for, or undefined when it succeeded. */
export function responseFailure(response: Response): GitHubFailure | undefined {
  if (response.ok) return undefined;
  if (response.status === 404) return { status: "not-found" };
  // GitHub answers an exhausted rate limit with 403 and no remaining requests, or 429 for secondary limits.
  const remaining = response.headers.get("x-ratelimit-remaining");
  if (response.status === 429 || (response.status === 403 && remaining === "0"))
    return { status: "rate-limited", resetAt: resetTime(response) };
  if (response.status === 403) return { status: "forbidden" };
  return {
    status: "error",
    message: `GitHub returned ${String(response.status)}.`,
  };
}

function resetTime(response: Response) {
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) return reset * 1000;
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0)
    return Date.now() + retryAfter * 1000;
  return undefined;
}

/** "3:42 PM", or undefined when GitHub did not say. */
export function formatResetTime(resetAt: number | undefined) {
  if (resetAt === undefined) return undefined;
  return new Date(resetAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function failureMessage(failure: GitHubFailure) {
  switch (failure.status) {
    case "not-found":
      return "GitHub has no public file here.";
    case "forbidden":
      return "GitHub refused this request.";
    case "rate-limited": {
      const at = formatResetTime(failure.resetAt);
      return at === undefined
        ? "GitHub's hourly request limit for your network ran out. Wait a few minutes, then refresh."
        : `GitHub's hourly request limit for your network ran out. It resets at ${at}.`;
    }
    case "offline":
      return "Couldn't reach GitHub. Check your connection, then refresh.";
    case "error":
      return failure.message;
  }
}
