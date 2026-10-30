import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";

export type Session = { id: string; userId: string; expiresAt: Date };

const TTL_MS = 1000 * 60 * 60 * 24 * 7;

/** Sessions live in Postgres, so they survive deploys and restarts. */
export class SessionStore {
  constructor(private readonly sql: Sql) {}

  async create(userId: string): Promise<Session> {
    const session = {
      id: randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + TTL_MS),
    };
    await this.sql`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (${session.id}, ${session.userId}, ${session.expiresAt})
    `;
    return session;
  }

  async find(id: string): Promise<Session | undefined> {
    // Expired rows never match, so no request sees a stale session.
    const [row] = await this.sql<Session[]>`
      SELECT id, user_id AS "userId", expires_at AS "expiresAt"
      FROM sessions
      WHERE id = ${id} AND expires_at > now()
    `;
    return row;
  }
}
