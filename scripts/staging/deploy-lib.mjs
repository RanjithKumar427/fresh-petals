// Pure checks for deploy-worker.mjs, testable without a network. Fixed descriptions only.
import { PRODUCTION_REF } from "./guard.mjs";

export const WORKER_NAME = "fresh-petals-staging";
export const HYPERDRIVE_NAME = "fresh-petals-staging-db";
export const PRODUCTION_HYPERDRIVE_NAME = "fresh-petals-db";
export const EXPECTED_SUBDOMAIN = "branjith-kumar24-01";
export const AUTH_ORIGIN = `https://${WORKER_NAME}.${EXPECTED_SUBDOMAIN}.workers.dev`;
/** Below Supavisor's session-mode pool_size (15), leaving room for builds, scripts and the dashboard. */
export const MAX_ORIGIN_CONNECTIONS = 10;
export const secretNamesToInstall =["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

/** Tracked changes or .env files stop a deploy. Untracked files outside the build inputs are only reported. */
export function repoFailures({ status, envFiles }) {
  const failures = envFiles.map((f) => `${f} exists: the build could read it`);
  const lines = status.split("\n").filter(Boolean);
  const untracked = [];
  for (const line of lines) {
    const file = line.slice(3);
    if (!line.startsWith("??")) failures.push(`uncommitted change: ${file}`);
    else if (/^(src|public|drizzle)\/|^astro\.config|^wrangler|^package|^scripts\/(build|cloudflare)\//.test(file)) failures.push(`untracked build input: ${file}`);
    else untracked.push(file);
  }
  return { failures, untracked };
}

/** Judges what Cloudflare reports for the configuration, not its name. */
export function originFailures(config, expected, productionId) {
  const failures = [];
  const o = config.origin ?? {};
  if (config.name !== HYPERDRIVE_NAME) failures.push("configuration name differs");
  if (productionId && config.id === productionId) failures.push("this is the production configuration");
  if (o.user !== expected.user) failures.push("origin user is not the staging project's");
  if (String(o.user ?? "").includes(PRODUCTION_REF) || String(o.host ?? "").includes(PRODUCTION_REF)) failures.push("origin references the production project");
  if (o.host !== expected.host) failures.push("origin host differs from the staging file");
  if (Number(o.port) !== expected.port) failures.push("origin port differs");
  if (o.database !== expected.database) failures.push("origin database differs");
  if (config.caching?.disabled !== true) failures.push("query caching is not disabled");
  if (config.mtls?.sslmode !== "verify-full" || !config.mtls?.ca_certificate_id) failures.push("TLS is not verify-full against a pinned CA");
  // Supavisor's session mode refuses clients beyond its pool_size (15 on this plan:
  // "EMAXCONNSESSION max clients reached", seen as 500s under a crawl on 6 Nov 2026).
  // Hyperdrive's default (20) exceeds it; at or below the limit Hyperdrive queues instead.
  if (!(Number(config.origin_connection_limit) > 0 && Number(config.origin_connection_limit) <= MAX_ORIGIN_CONNECTIONS)) failures.push(`origin connection limit is not 1–${MAX_ORIGIN_CONNECTIONS} (the session pooler allows 15 clients)`);
  return failures;
}

/** The final Worker configuration, immediately before it is deployed. */
export function workerConfigFailures(worker, hyperdriveId, productionId) {
  const failures = [];
  const vars = worker.vars ?? {};
  if (worker.name !== WORKER_NAME) failures.push(`Worker is named ${worker.name}`);
  if (worker.workers_dev !== true) failures.push("workers_dev is not on");
  if (worker.preview_urls !== false) failures.push("preview URLs are not off");
  if (worker.routes?.length || worker.route) failures.push("routes are set");
  if (worker.observability?.enabled !== false) failures.push("observability is on");
  if (vars.FP_DEPLOY_ENV !== "staging") failures.push("FP_DEPLOY_ENV is not staging");
  if (vars.SITE_URL !== "https://onlyfreshpetals.in") failures.push("SITE_URL is not the production canonical");
  if (vars.FP_AUTH_ORIGIN !== AUTH_ORIGIN) failures.push("FP_AUTH_ORIGIN differs");
  if (!/^\d+$/.test(vars.FP_STAGING_DB_ID ?? "")) failures.push("FP_STAGING_DB_ID is missing");
  if (worker.images?.binding !== "IMAGES") failures.push("Images binding is missing");
  const bound = worker.hyperdrive ?? [];
  if (bound.length !== 1 || bound[0].binding !== "HYPERDRIVE" || bound[0].id !== hyperdriveId) failures.push("Hyperdrive binding is not the staging configuration");
  if (productionId && bound.some((h) => h.id === productionId)) failures.push("the production Hyperdrive is bound");
  if (JSON.stringify(worker).includes(PRODUCTION_REF)) failures.push("the configuration references the production project");
  return failures;
}
