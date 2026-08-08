// Translates raw node-postgres/Drizzle errors into short, friendly messages
// safe to surface to the UI. Shared across every Postgres-backed repository
// (not just ProductRepository) so the mapping stays in one place as more
// repositories migrate in later phases.
//
// Why this exists at all: a repository method that lets a raw pg error
// propagate up leaks internals (column names, constraint names, sometimes
// the query itself) into a JSON error response the browser renders
// directly — a real information-disclosure smell, not just an ugly
// message. Every repository method that writes should catch here.
export class RepositoryError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RepositoryError";
  }
}

// Postgres SQLSTATE codes relevant here — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const NOT_NULL_VIOLATION = "23502";
const CHECK_VIOLATION = "23514";

// Drizzle wraps the real node-postgres driver error in its own Error
// (e.g. DrizzleQueryError) rather than throwing the pg error directly —
// the actual SQLSTATE `code` lives on `error.cause`, not on `error`
// itself. Verified against a real thrown error, not assumed: an earlier
// version of this file checked `error.code` directly and silently fell
// through to the generic fallback message on every real constraint
// violation, because that property was always undefined at that level.
function pgCode(error: unknown): string | undefined {
  const err = error as { code?: string; cause?: { code?: string } } | null;
  return err?.code ?? err?.cause?.code;
}

function isTimeoutOrConnectionIssue(error: unknown): boolean {
  const code = pgCode(error);
  const message = error instanceof Error ? error.message : String(error);
  // Network/pool-level failures don't carry a Postgres SQLSTATE the way
  // constraint violations do — they surface as Node's own socket error
  // codes, or as pg-pool's own "timeout exceeded" wording when every
  // pooled connection is checked out and none frees up in time.
  return (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    /timeout/i.test(message)
  );
}

export function translatePgError(error: unknown): RepositoryError {
  if (error instanceof RepositoryError) return error; // already translated by a nested call

  const code = pgCode(error);

  if (code === FOREIGN_KEY_VIOLATION) {
    // The one failure mode this phase deliberately can't fully close: a
    // product referencing an image/category/tag that only exists in
    // SQLite so far (MediaRepository etc. haven't migrated yet — see
    // docs/architecture/supabase-migration.md, Phase 2B.1). Worded to
    // point at the most common real cause rather than a generic "conflict".
    return new RepositoryError(
      "One of the selected images, categories, or tags isn't available in the new database yet. " +
        "If you just uploaded a new image, please try again in a moment — if this keeps happening, " +
        "it means that item hasn't been migrated yet.",
      error
    );
  }
  if (code === UNIQUE_VIOLATION) {
    return new RepositoryError("That value is already in use. Please choose a different one.", error);
  }
  if (code === NOT_NULL_VIOLATION || code === CHECK_VIOLATION) {
    return new RepositoryError("A required field was missing or invalid. Please check the form and try again.", error);
  }
  if (isTimeoutOrConnectionIssue(error)) {
    return new RepositoryError("Our database is temporarily unavailable. Please try again in a moment.", error);
  }

  return new RepositoryError("Something went wrong saving this product. Please try again.", error);
}

/** Logs the real error server-side (for ops visibility) and throws the friendly, translated one. */
export function logAndTranslate(context: string, error: unknown): never {
  console.error(`[${context}]`, error);
  throw translatePgError(error);
}
