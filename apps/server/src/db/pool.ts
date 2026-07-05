/**
 * PostgreSQL connection pool + transaction helper (M1-CONTRACT §3).
 *
 * The data layer is raw SQL over `pg` — no ORM. Every query uses $1-style parameter
 * placeholders; SQL text is assembled ONLY from static fragments (CLAUDE.md §4).
 */
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * Shared pool, configured from DATABASE_URL. `new Pool` does not connect eagerly, so
 * importing this module is safe in environments without a database (e.g. unit tests that
 * never touch a repository). If DATABASE_URL is unset, pg falls back to its standard
 * PG* environment variables.
 */
export const pgPool: Pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Minimal query surface shared by Pool and PoolClient, so a repository method can run the
 * same SQL directly on the pool or inside a caller-provided transaction. Calling `.query`
 * on the raw `Pool | PoolClient` union trips over pg's overload sets; this structural
 * interface sidesteps that.
 */
export interface SqlExecutor {
  query<R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    // reason: `any[]` mirrors pg's own `query(text, values?: any[])` signature so both
    // Pool and PoolClient remain structurally assignable to this interface.
    values?: any[],
  ): Promise<QueryResult<R>>;
}

/** Pick the executor: the caller's transaction client if provided, else the shared pool. */
export function getExecutor(client?: PoolClient): SqlExecutor {
  return client ?? pgPool;
}

/**
 * Runs `fn` inside a single transaction: BEGIN → fn → COMMIT, ROLLBACK on any throw,
 * client released in finally. This is the ONLY place BEGIN/COMMIT/ROLLBACK are issued.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ROLLBACK can only fail when the connection itself is broken; the original
      // error is the one worth surfacing, so swallow the rollback failure.
    }
    throw err;
  } finally {
    client.release();
  }
}

/** PostgreSQL SQLSTATE for unique_violation. */
export const PG_UNIQUE_VIOLATION = '23505';

/**
 * True when `err` is a Postgres unique-constraint violation — optionally restricted to a
 * specific constraint name (e.g. 'venues_slug_key', 'bookings_client_request_id_key').
 */
export function isUniqueViolation(err: unknown, constraintName?: string): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const pgErr = err as { code?: unknown; constraint?: unknown };
  if (pgErr.code !== PG_UNIQUE_VIOLATION) {
    return false;
  }
  return constraintName === undefined || pgErr.constraint === constraintName;
}

/**
 * Escapes LIKE/ILIKE wildcard characters in user-supplied search text.
 * Use together with `ILIKE $n ESCAPE '\'` so 'a_b%' matches literally.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
