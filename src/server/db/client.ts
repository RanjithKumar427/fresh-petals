// Single shared SQLite connection for the whole app. This is the ONLY file
// in src/server allowed to talk to node:sqlite directly — everything else
// (repositories) receives a Database from getDb() and never opens its own
// connection or reaches for a filesystem path itself.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
// `?raw` inlines the file's contents into the JS bundle at build time —
// unlike readFileSync(new URL(...)), this survives being bundled into
// dist/server/chunks, where schema.sql itself wouldn't otherwise be copied.
import schemaSql from "./schema.sql?raw";
import { DATA_DIR, DB_PATH } from "./paths.mjs";

let db: DatabaseSync | null = null;

function ensureSchema(database: DatabaseSync) {
  database.exec(schemaSql);
}

/**
 * Returns the shared SQLite connection, creating the database file and
 * applying the schema on first access. Safe to call from anywhere in
 * src/server — it's memoized, so the schema only runs once per process.
 */
export function getDb(): DatabaseSync {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  ensureSchema(db);

  return db;
}

/** ISO-8601 timestamp helper, used consistently across repositories. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * node:sqlite has no built-in `.transaction()` wrapper (unlike
 * better-sqlite3) — this is the one place BEGIN/COMMIT/ROLLBACK is spelled
 * out, so repositories that need multi-statement writes (product create/
 * update, which touches junction tables) call this instead of managing
 * transaction state themselves.
 */
export function withTransaction<T>(fn: (database: DatabaseSync) => T): T {
  const database = getDb();
  database.exec("BEGIN");
  try {
    const result = fn(database);
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
