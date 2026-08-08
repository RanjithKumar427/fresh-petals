// Single shared Postgres connection pool for the whole app — the Supabase
// replacement for src/server/db/client.ts's node:sqlite singleton. This is
// the ONLY file allowed to construct a `pg.Pool` or a Drizzle instance;
// repositories import `getDb()` from here and never touch `pg` directly,
// mirroring the exact discipline the SQLite client enforced. (Naming note:
// this file and src/server/db/client.ts share a name by folder-convention
// — db/client.ts is SQLite, db/postgres/client.ts is Postgres — deliberate
// during the transition; Phase 6 deletes the former and this file moves up
// to db/client.ts, dropping the qualifier once it's the only one left.)
//
// Connects through Supabase's Transaction Pooler (Supavisor), not a direct
// connection — it's what keeps repository-level transactions (BEGIN/
// COMMIT/ROLLBACK) working exactly as they did against SQLite, which plain
// supabase-js/PostgREST can't offer. Supavisor itself multiplexes many
// client connections onto a smaller real-Postgres backend budget, so the
// pool size below is sized against the pooler's *client* connection limit
// (200 on this project's Nano tier), not the smaller backend figure — see
// docs/architecture/supabase-migration.md for the full reasoning.
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { supabasePoolSsl } from "./ssl";

type Globals = typeof globalThis & { __fpPgPool?: Pool; __fpDrizzleDb?: NodePgDatabase<typeof schema> };
const globals = globalThis as Globals;

/**
 * Returns the shared Drizzle instance, creating the pool on first access.
 * Deliberately lazy (not created at module load) so importing this file
 * never fails just because DATABASE_URL isn't set yet in an environment
 * that hasn't reached a query — the error surfaces at first real use
 * instead, with a message that says exactly what's missing.
 *
 * Cached on `globalThis` rather than a plain module-level variable: under
 * `astro dev`, Vite's SSR module graph re-executes this file whenever it
 * (or something it imports) changes, which would otherwise construct a
 * fresh, never-closed pool on every edit during a long local session —
 * quietly leaking connections against a small, real, shared budget. The
 * globalThis cache survives that re-execution the same way Prisma/Next.js
 * recommend for the identical problem; it's a no-op in production, where
 * each serverless instance's module scope is fresh exactly once anyway.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (globals.__fpDrizzleDb) return globals.__fpDrizzleDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in the Supabase " +
        "Transaction Pooler connection string from Settings → Database → Connection pooling."
    );
  }

  // Kept small deliberately: many concurrent serverless instances each
  // hold their own pool against one shared client-connection budget (200
  // on Nano). A handful of connections per instance is plenty — a single
  // function invocation issues one query/transaction at a time in the
  // overwhelming common case — and staying small costs nothing, since
  // Supavisor is already doing the real pooling work on its side.
  const pool = new Pool({
    connectionString,
    max: 3,
    // Supabase's pooler always requires TLS, and its chain is rooted at
    // Supabase's own self-issued CA rather than a publicly trusted one —
    // `rejectUnauthorized: true` alone isn't enough, the CA itself has to
    // be supplied. See ssl.ts for the full explanation.
    ssl: supabasePoolSsl,
  });
  const db = drizzle(pool, { schema });

  globals.__fpPgPool = pool;
  globals.__fpDrizzleDb = db;
  return db;
}

export type Database = NodePgDatabase<typeof schema>;
export { schema };

/**
 * Postgres equivalent of the SQLite client's withTransaction() — same
 * call shape repositories already use (product create/update touching up
 * to 7 tables atomically), backed by a real BEGIN/COMMIT/ROLLBACK via the
 * pooled connection rather than SQLite's single-file locking. Drizzle's
 * own `db.transaction()` is the idiomatic form here, so this is a thin
 * naming wrapper for continuity with the existing repository code, not a
 * reimplementation.
 */
export async function withTransaction<T>(fn: (tx: NodePgDatabase<typeof schema>) => Promise<T>): Promise<T> {
  return getDb().transaction(fn);
}
