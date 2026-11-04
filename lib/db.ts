import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * DATABASE_SSL: "disable" | "require" (encrypt, don't verify cert) | "verify" (default in production).
 */
export function sslConfig() {
  const mode = process.env.DATABASE_SSL || (process.env.NODE_ENV === "production" ? "verify" : "disable");
  if (mode === "disable") return undefined;
  if (mode === "require") return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}

const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: sslConfig()
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values: unknown[] = []
) {
  return pool.query<T>(sql, values);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
