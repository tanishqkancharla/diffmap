const SHORT_SHA_LENGTH = 7;

/** First seven hex characters of a commit SHA, lowercased. */
export function shortSha(sha: string): string {
  return sha.slice(0, SHORT_SHA_LENGTH).toLowerCase();
}
