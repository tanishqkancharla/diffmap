import { randomUUID } from "node:crypto";

export type Session = { id: string; userId: string; expiresAt: Date };

const TTL_MS = 1000 * 60 * 60 * 24 * 7;

// Lives in this process: a deploy or a crash signs everyone out.
const sessions = new Map<string, Session>();

export function createSession(userId: string): Session {
  const session = {
    id: randomUUID(),
    userId,
    expiresAt: new Date(Date.now() + TTL_MS),
  };
  sessions.set(session.id, session);
  return session;
}

export function findSession(id: string): Session | undefined {
  const session = sessions.get(id);
  if (session === undefined) return undefined;
  if (session.expiresAt.getTime() < Date.now()) {
    sessions.delete(id);
    return undefined;
  }
  return session;
}
