/**
 * Prints the SQL that creates Better Auth's tables for `authOptions`, by
 * migrating an empty in-memory SQLite database dressed as D1. Run it after
 * changing the auth plugins and save the output as a new file in
 * `cloud/migrations/`: `node --import tsx src/cloud/authSchema.ts`.
 */
import { DatabaseSync } from "node:sqlite";
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "./auth.ts";
import type { D1Database, D1PreparedStatement, Env } from "./env.ts";

function memoryD1(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  const statement = (query: string, values: unknown[]): D1PreparedStatement => {
    const run = () =>
      sqlite.prepare(query).all(...(values as never[])) as Record<
        string,
        unknown
      >[];
    return {
      bind: (...next) => statement(query, next),
      // oxlint-disable-next-line unicorn/no-null -- D1 answers null for no row.
      first: <T>() => Promise.resolve((run()[0] ?? null) as T | null),
      all: <T>() =>
        Promise.resolve({ results: run() as T[], success: true, meta: {} }),
      run: () => Promise.resolve({ results: run(), success: true, meta: {} }),
      raw: <T>() => Promise.resolve(run().map(Object.values) as T[]),
    };
  };
  return {
    prepare: (query) => statement(query, []),
    batch: <T>(statements: D1PreparedStatement[]) =>
      Promise.all(statements.map((s) => s.all<T>())),
    exec: (query) => Promise.resolve(sqlite.exec(query)),
  };
}

const env = {
  DB: memoryD1(),
  BETTER_AUTH_URL: "http://localhost",
  BETTER_AUTH_SECRET: "schema-only-secret-schema-only-secret",
  DEV_SIGN_IN: "1",
} as unknown as Env;

const { compileMigrations } = await getMigrations(authOptions(env));
console.log(await compileMigrations());
