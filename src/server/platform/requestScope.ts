// Per-request state for the Cloudflare Workers runtime.
//
// A Worker isolate serves many requests at once and may not reuse an I/O
// object (such as a Postgres socket) created by a different request, so the
// database pool that Node/Vercel keep for the whole process is created per
// request on Workers instead. src/middleware.ts opens one scope per request;
// getDb() (src/server/db/postgres/client.ts) reads it. In Node (local dev,
// prerendering at build time, Vercel) no scope is opened and nothing changes.
import { AsyncLocalStorage } from "node:async_hooks";

export type RequestScope = {
  /** Postgres connection string for this request (Hyperdrive when bound, else DATABASE_URL). */
  connectionString?: string;
  /** True when connectionString comes from the Hyperdrive binding (no TLS on that hop). */
  viaHyperdrive?: boolean;
  /** Lazily created per-request database handle. */
  db?: unknown;
};

export const requestScope = new AsyncLocalStorage<RequestScope>();

let envPromise: Promise<Record<string, unknown>> | undefined;

/**
 * The Worker's bindings (Hyperdrive, Images, assets). Imported by a runtime
 * specifier so that Node builds (Vercel, prerendering) never try to resolve
 * the `cloudflare:` module.
 */
export function cloudflareEnv(): Promise<Record<string, unknown>> {
  const specifier = "cloudflare:workers";
  envPromise ??= import(/* @vite-ignore */ specifier).then((mod: { env: Record<string, unknown> }) => mod.env);
  return envPromise;
}

/** Opens a request scope whose database connection comes from Hyperdrive when bound. */
export async function workerScope(): Promise<RequestScope> {
  const env = await cloudflareEnv();
  const hyperdrive = env.HYPERDRIVE as { connectionString?: string } | undefined;
  if (hyperdrive?.connectionString) return { connectionString: hyperdrive.connectionString, viaHyperdrive: true };
  return { connectionString: process.env.DATABASE_URL, viaHyperdrive: false };
}
