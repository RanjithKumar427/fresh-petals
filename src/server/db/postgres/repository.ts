// Shared cross-cutting infrastructure for every Postgres-backed repository.
// Extracted here in Phase 2B.2 rather than duplicated a third time —
// Phase 2B.1 wrote this pattern once, inline, for ProductRepository alone
// (as `pgErrors.ts` + a local `withErrorTranslation` helper); with three
// more repositories landing in this phase, "would three repositories
// implement the same logic" stopped being hypothetical. ProductRepository
// was retrofitted to import from here too, so there is exactly one copy of
// this logic, not four.
//
// What this deliberately is NOT: a monitoring stack, a retry framework, or
// a circuit breaker. Those are real future needs (see the Phase 2B.2
// report's Infrastructure Evolution Review) but building them now, before
// anything has enough real traffic to tell you what they'd actually need
// to do, would be guessing. What's here is the seam those things attach
// to later — one function every repository method already calls, so
// adding retry/metrics/tracing later means changing this file once, not
// re-touching every repository.
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
// itself. Verified against a real thrown error during Phase 2B.1, not
// assumed: an earlier version of this checked `error.code` directly and
// silently fell through to the generic fallback message on every real
// constraint violation, because that property was always undefined at
// that level.
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
  // pooled connection is checked out and none frees up in time. Confirmed
  // live during Phase 2B.1's own verification: a transient DNS failure
  // resolving the pooler host surfaced exactly this way, on a plain read.
  return (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    /timeout/i.test(message)
  );
}

/**
 * Entity-agnostic on purpose — this file is shared by every repository, so
 * "saving this product" (Phase 2B.1's original, narrower wording) became
 * "saving this" here. Callers that want to name the entity do so in the
 * `context` string passed to `withRepositoryCall`, which lands in the
 * server log, not in the message shown to the user.
 */
export function translatePgError(error: unknown): RepositoryError {
  if (error instanceof RepositoryError) return error; // already translated by a nested call

  const code = pgCode(error);

  if (code === FOREIGN_KEY_VIOLATION) {
    return new RepositoryError(
      "One of the selected items isn't available in the database yet. If you just created or " +
        "uploaded it, please try again in a moment — if this keeps happening, it means that item " +
        "hasn't been migrated to the new database yet.",
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

  return new RepositoryError("Something went wrong. Please try again.", error);
}

// Deliberately conservative — this isn't tuned against real production
// latency data (there isn't any yet), it exists so a "this is slow" signal
// shows up in logs *now*, in dev, rather than the first time someone
// notices production feels slow with nothing to point at. Revisit once
// real query timings exist to calibrate against.
const SLOW_QUERY_THRESHOLD_MS = 500;

/**
 * The one function every repository method routes through. Three jobs:
 *   1. Translate raw pg/Drizzle errors into safe, friendly messages
 *      (never let a raw error reach an API response — see
 *      RepositoryError above).
 *   2. Log the *real* error server-side before translating it away, so
 *      operators aren't left with only the friendly version.
 *   3. Time every call and flag slow ones — the observability seam this
 *      phase's brief asked for: not a metrics/tracing system, just a
 *      structured place a real one could hook into later (swap the
 *      console.warn for a metrics emit, without touching any repository).
 */
export async function withRepositoryCall<T>(context: string, fn: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await fn();
    const durationMs = performance.now() - startedAt;
    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`[${context}] slow (${durationMs.toFixed(0)}ms)`);
    }
    return result;
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    console.error(`[${context}] failed after ${durationMs.toFixed(0)}ms:`, error);
    throw translatePgError(error);
  }
}
