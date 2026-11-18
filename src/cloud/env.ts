/**
 * The bindings `alchemy.run.ts` gives the productdoc.dev Worker. These are
 * the parts of the Workers types it uses, declared here so the Worker shares the
 * repository's DOM-based tsconfig.
 */

export type D1Result<T> = {
  results: T[];
  success: boolean;
  meta: { changes: number };
};

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
  raw<T = unknown[]>(): Promise<T[]>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<unknown>;
}

export interface R2Object {
  key: string;
  size: number;
  httpMetadata?: { contentType?: string };
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

export interface R2Bucket {
  head(key: string): Promise<R2Object | null>;
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | string,
    options?: {
      httpMetadata?: { contentType?: string };
      sha256?: string;
    },
  ): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
}

export interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export type Env = {
  DB: D1Database;
  BLOBS: R2Bucket;
  /** The website build in `dist/`. */
  ASSETS: Fetcher;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  /** Authorizes `npm run cloud:takedown`. */
  ADMIN_TOKEN: string;
  /** Comma-separated emails of the accounts that may share. */
  PUBLISHERS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /** "1" in local development only: sign in by email, with no Google or GitHub app. */
  DEV_SIGN_IN?: string;
};
