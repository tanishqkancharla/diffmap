/**
 * What sharing refuses to upload without `--allow`: text that looks like a
 * credential, and files whose names usually hold one. These patterns favor
 * catching a real key over never flagging a harmless example.
 */

const PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "a private key", pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
  { name: "an AWS access key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  {
    name: "a GitHub token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/,
  },
  { name: "a Slack token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "a Stripe secret key", pattern: /\b[rs]k_live_[A-Za-z0-9]{20,}\b/ },
  {
    name: "an OpenAI or Anthropic key",
    pattern: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}\b/,
  },
  { name: "a Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    name: "a password or secret",
    pattern:
      /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i,
  },
];

const PRIVATE_NAMES = [
  /(?:^|\/)\.env(?:\.[\w.-]+)?$/,
  /\.(?:pem|key|p12|pfx)$/i,
  /(?:^|\/)id_(?:rsa|dsa|ecdsa|ed25519)$/,
  /(?:^|\/)\.npmrc$/,
  /(?:^|\/)credentials(?:\.json)?$/i,
];

/** Why this file shouldn't be shared, or undefined when it looks fine. */
export function secretReason(path: string, text: string | undefined) {
  if (PRIVATE_NAMES.some((pattern) => pattern.test(path)))
    return "its name is one that usually holds credentials";
  if (text === undefined) return undefined;
  const found = PATTERNS.find(({ pattern }) => pattern.test(text));
  return found === undefined
    ? undefined
    : `it looks like it holds ${found.name}`;
}
